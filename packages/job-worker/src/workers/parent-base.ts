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
import { ChangeStream, ChangeStreamDocument, MongoClient } from 'mongodb'
import { createInvalidateWorkerDataCache, InvalidateWorkerDataCache } from './caches'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { logger } from '../logging'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { LocksManager } from '../locks'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { FORCE_CLEAR_CACHES_JOB } from '@sofie-automation/corelib/dist/worker/shared'
import { JobManager, JobStream } from '../manager'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { Promisify, ThreadedClassManager } from 'threadedclass'

export enum ThreadStatus {
	Closed = 0,
	PendingInit = 1,
	Ready = 2,
}

export abstract class WorkerParentBase {
	// readonly #workerId: string
	readonly #studioId: StudioId
	readonly #threadId: string

	readonly #mongoClient: MongoClient
	readonly #locksManager: LocksManager

	#terminate: ManualPromise<void> | undefined

	readonly #jobManager: JobManager
	readonly #jobStream: JobStream

	readonly #streams: Array<ChangeStream<any>> = []

	#pendingInvalidations: InvalidateWorkerDataCache | null = null

	#threadStatus = ThreadStatus.Closed

	public get threadId(): string {
		return this.#threadId
	}

	protected constructor(
		workerId: string,
		threadId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		jobManager: JobManager
	) {
		// this.#workerId = workerId
		this.#studioId = studioId
		this.#threadId = threadId
		this.#mongoClient = mongoClient
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

	/**
	 * Subscribe to core changes in the db for cache invalidation.
	 * Can be extended if move collections are watched for a thread type
	 */
	protected subscribeToCacheInvalidations(dbName: string): void {
		const attachChangesStream = <T>(
			stream: ChangeStream<T>,
			name: string,
			fcn: (invalidations: InvalidateWorkerDataCache, change: ChangeStreamDocument<T>) => void
		): void => {
			this.#streams.push(stream)
			stream.on('change', (change) => {
				// we have a change to flag
				if (!this.#pendingInvalidations) this.#pendingInvalidations = createInvalidateWorkerDataCache()
				fcn(this.#pendingInvalidations, change as ChangeStreamDocument<T>)
			})
			stream.on('end', () => {
				logger.warn(`Changes stream for ${name} ended`)
				if (!this.#terminate) this.#terminate = createManualPromise()
			})
		}

		// TODO: Worker - maybe these should be shared across threads, as there will be a bunch looking for the exact same changes..
		const database = this.#mongoClient.db(dbName)
		attachChangesStream<DBStudio>(
			database.collection(CollectionName.Studios).watch([{ $match: { _id: this.#studioId } }], {
				batchSize: 1,
			}),
			`Studio "${this.#studioId}"`,
			(invalidations) => {
				invalidations.studio = true
			}
		)
		attachChangesStream<Blueprint>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.Blueprints).watch(
				[
					// TODO: Worker - can/should this be scoped down at all?
				],
				{
					batchSize: 1,
				}
			),
			`Blueprints"`,
			(invalidations, change) => {
				if (change.documentKey) {
					invalidations.blueprints.push(change.documentKey)
				}
			}
		)
		attachChangesStream<DBShowStyleBase>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.ShowStyleBases).watch(
				[
					// TODO: Worker - can/should this be scoped down at all?
				],
				{
					batchSize: 1,
				}
			),
			`ShowStyleBases"`,
			(invalidations, change) => {
				if (change.documentKey) {
					invalidations.showStyleBases.push(change.documentKey)
				}
			}
		)
		attachChangesStream<DBShowStyleVariant>(
			// Detect changes to other docs, the invalidate will filter out irrelevant values
			database.collection(CollectionName.ShowStyleVariants).watch(
				[
					// TODO: Worker - can/should this be scoped down at all?
				],
				{
					batchSize: 1,
				}
			),
			`ShowStyleVariants"`,
			(invalidations, change) => {
				if (change.documentKey) {
					invalidations.showStyleVariants.push(change.documentKey)
				}
			}
		)
	}

	/** Initialise the worker thread */
	protected abstract initWorker(mongoUri: string, dbName: string, studioId: StudioId): Promise<void>
	/** Invalidate caches in the worker thread */
	protected abstract invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void>
	/** Run a job in the worker thread */
	protected abstract runJobInWorker(name: string, data: any): Promise<any>
	/** Terminate the worker thread */
	protected abstract terminateWorkerThread(): Promise<void>
	/** Inform the worker thread about a lock change */
	public abstract workerLockChange(lockId: string, locked: boolean): Promise<void>

	/** Start the loop feeding work to the worker */
	protected startWorkerLoop(mongoUri: string, dbName: string): void {
		setImmediate(async () => {
			try {
				this.#pendingInvalidations = null

				this.subscribeToCacheInvalidations(dbName)

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
						const invalidations = this.#pendingInvalidations
						this.#pendingInvalidations = null

						await this.invalidateWorkerCaches(invalidations)
					}

					// TODO: Worker - enforce a timeout? we could kill the thread once it reaches the limit as a hard abort

					// we may not get a job even when blocking, so try again
					if (job) {
						// Ensure the lock is still good
						// await job.extendLock(this.#workerId, 10000) // Future - ensure the job is locked for enough to process

						const transaction = startTransaction(job.name, 'worker-parent')
						if (transaction) {
							transaction.setLabel('studioId', unprotectString(this.#studioId))
						}

						const startTime = Date.now()

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
							await this.#jobManager.jobFinished(job.id, startTime, endTime, null, result)
							logger.debug(`Completed work ${job.id} in ${endTime - startTime}ms`)
						} catch (e: unknown) {
							console.log('inner err2', e, typeof e, JSON.stringify(e))
							let error: Error | UserError
							if (e instanceof Error || UserError.isUserError(e)) {
								error = e
							} else {
								error = new Error(typeof e === 'string' ? e : `${e}`)
							}

							logger.error(`Job errored ${job.id} "${job.name}": ${stringifyError(e)}`)

							await this.#jobManager.jobFinished(job.id, startTime, Date.now(), error, null)
						}

						console.log('after work')
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
