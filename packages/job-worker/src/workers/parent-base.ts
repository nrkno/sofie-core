import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ManualPromise,
	createManualPromise,
	stringifyError,
	assertNever,
	sleep,
} from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { startTransaction } from '../profiler'
import { ChangeStream, MongoClient } from 'mongodb'
import { createInvalidateWorkerDataCache, InvalidateWorkerDataCache } from './caches'
import { logger } from '../logging'
import { LocksManager } from '../locks'
import { FORCE_CLEAR_CACHES_JOB } from '@sofie-automation/corelib/dist/worker/shared'
import { JobManager, JobStream } from '../manager'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { Promisify, ThreadedClassManager } from 'threadedclass'

export enum ThreadStatus {
	Closed = 0,
	PendingInit = 1,
	Ready = 2,
}

/** How often to check the job for reaching the max duration */
const WATCHDOG_INTERVAL = 5 * 1000
/** The maximum duration a job is allowed to run for before the thread is killed */
const WATCHDOG_KILL_DURATION = 30 * 1000

export abstract class WorkerParentBase {
	// readonly #workerId: string
	readonly #studioId: StudioId
	readonly #threadId: string

	// readonly #mongoClient: MongoClient
	readonly #locksManager: LocksManager

	#terminate: ManualPromise<void> | undefined

	readonly #jobManager: JobManager
	readonly #jobStream: JobStream

	readonly #streams: Array<ChangeStream<any>> = []

	#pendingInvalidations: InvalidateWorkerDataCache | null = null

	#threadStatus = ThreadStatus.Closed

	#watchdog: NodeJS.Timeout | undefined
	#watchdogJobStarted: number | undefined

	public get threadId(): string {
		return this.#threadId
	}

	protected constructor(
		workerId: string,
		threadId: string,
		studioId: StudioId,
		_mongoClient: MongoClient, // Included here for future use
		locksManager: LocksManager,
		queueName: string,
		jobManager: JobManager
	) {
		// this.#workerId = workerId
		this.#studioId = studioId
		this.#threadId = threadId
		// this.#mongoClient = mongoClient
		this.#locksManager = locksManager

		this.#jobManager = jobManager
		this.#jobStream = jobManager.subscribeToQueue(queueName, workerId)

		this.#threadStatus = ThreadStatus.PendingInit
	}

	protected registerStatusEvents(workerThread: Promisify<any>): void {
		ThreadedClassManager.onEvent(workerThread, 'restarted', () => {
			this.#threadStatus = ThreadStatus.PendingInit
		})
		ThreadedClassManager.onEvent(workerThread, 'thread_closed', () => {
			this.#threadStatus = ThreadStatus.Closed
		})
	}

	/** Queue a cache invalidation for the thread */
	public queueCacheInvalidation(invalidatorFcn: (invalidations: InvalidateWorkerDataCache) => void): void {
		if (!this.#pendingInvalidations) this.#pendingInvalidations = createInvalidateWorkerDataCache()
		invalidatorFcn(this.#pendingInvalidations)
	}

	/** Initialise the worker thread */
	protected abstract initWorker(mongoUri: string, dbName: string, studioId: StudioId): Promise<void>
	/** Invalidate caches in the worker thread */
	protected abstract invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void>
	/** Run a job in the worker thread */
	protected abstract runJobInWorker(name: string, data: any): Promise<any>
	/** Terminate the worker thread */
	protected abstract terminateWorkerThread(): Promise<void>
	/** Restart the worker thread */
	protected abstract restartWorkerThread(): Promise<void>
	/** Inform the worker thread about a lock change */
	public abstract workerLockChange(lockId: string, locked: boolean): Promise<void>

	/** Start the loop feeding work to the worker */
	protected startWorkerLoop(mongoUri: string, dbName: string): void {
		if (!this.#watchdog) {
			// Start a watchdog, to detect if a job has been running for longer than a max threshold. If it has, then we forcefully kill it
			// ThreadedClass will propogate the completion error through the usual route
			this.#watchdog = setInterval(() => {
				if (this.#watchdogJobStarted && this.#watchdogJobStarted + WATCHDOG_KILL_DURATION < Date.now()) {
					// A job has been running for too long.

					logger.warn(`Force restarting worker thread: "${this.#threadId}"`)
					this.#watchdogJobStarted = undefined
					this.restartWorkerThread().catch((e) => {
						logger.warn(`Restarting worker thread "${this.#threadId}" error: ${stringifyError(e)}`)
					})
				}
			}, WATCHDOG_INTERVAL)
		}

		setImmediate(async () => {
			try {
				this.#pendingInvalidations = null

				// Future: subscribe to worker specific cache invalidations here
				// this.subscribeToCacheInvalidations(dbName)

				// Run until told to terminate
				while (!this.#terminate) {
					switch (this.#threadStatus) {
						case ThreadStatus.Closed:
							// Wait for the thread
							await sleep(100)
							// Check again
							continue
						case ThreadStatus.PendingInit:
							logger.debug(`Re-initialising worker thread: "${this.#threadId}"`)
							// Reinit the worker
							await this.initWorker(mongoUri, dbName, this.#studioId)
							this.#threadStatus = ThreadStatus.Ready
							break
						case ThreadStatus.Ready:
							// Thread is happy to accept a job
							break
						default:
							assertNever(this.#threadStatus)
					}

					const job = await this.#jobStream.next() // Note: this blocks

					// Handle any invalidations
					if (this.#pendingInvalidations) {
						logger.debug(`Invalidating worker caches: ${JSON.stringify(this.#pendingInvalidations)}`)
						const invalidations = this.#pendingInvalidations
						this.#pendingInvalidations = null

						await this.invalidateWorkerCaches(invalidations)
					}

					// we may not get a job even when blocking, so try again
					if (job) {
						// Ensure the lock is still good
						// await job.extendLock(this.#workerId, 10000) // Future - ensure the job is locked for enough to process

						const transaction = startTransaction(job.name, 'worker-parent')
						if (transaction) {
							transaction.setLabel('studioId', unprotectString(this.#studioId))
						}

						const startTime = Date.now()
						this.#watchdogJobStarted = startTime

						try {
							logger.debug(`Starting work ${job.id}: "${job.name}"`)
							logger.verbose(`Payload ${job.id}: ${JSON.stringify(job.data)}`)

							// Future - extend the job lock on an interval
							let result: any
							if (job.name === FORCE_CLEAR_CACHES_JOB) {
								const invalidations = this.#pendingInvalidations ?? createInvalidateWorkerDataCache()
								this.#pendingInvalidations = null

								invalidations.forceAll = true
								await this.invalidateWorkerCaches(invalidations)

								result = undefined
							} else {
								result = await this.runJobInWorker(job.name, job.data)
							}

							const endTime = Date.now()
							this.#watchdogJobStarted = undefined
							await this.#jobManager.jobFinished(job.id, startTime, endTime, null, result)
							logger.debug(`Completed work ${job.id} in ${endTime - startTime}ms`)
						} catch (e: unknown) {
							let error: Error | UserError
							if (e instanceof Error || UserError.isUserError(e)) {
								error = e
							} else {
								error = new Error(typeof e === 'string' ? e : `${e}`)
							}

							logger.error(`Job errored ${job.id} "${job.name}": ${stringifyError(e)}`)

							this.#watchdogJobStarted = undefined
							await this.#jobManager.jobFinished(job.id, startTime, Date.now(), error, null)
						}

						// Ensure all locks have been freed after the job
						await this.#locksManager.releaseAllForThread(this.#threadId)

						transaction?.end()
					}
				}

				// Mark completed
				this.#terminate.manualResolve()
			} catch (e) {
				logger.error(`Worker thread errored: ${stringifyError(e)}`)

				await this.#locksManager.releaseAllForThread(this.#threadId)

				// Ensure the termination is tracked
				if (!this.#terminate) {
					this.#terminate = createManualPromise()
				}

				// Mark completed
				this.#terminate.manualResolve()
			}
		})
	}

	/** Terminate and cleanup the worker thread */
	async terminate(): Promise<void> {
		if (this.#watchdog) {
			clearInterval(this.#watchdog)
			this.#watchdog = undefined
		}

		await this.#locksManager.releaseAllForThread(this.#threadId)

		if (!this.#terminate) {
			this.#terminate = createManualPromise()
		}
		// wait for the work loop to exit
		await this.#terminate

		// stop the thread
		await this.terminateWorkerThread()

		await Promise.all(this.#streams.map((s) => s.close()))

		await this.#jobStream.close()
	}
}
