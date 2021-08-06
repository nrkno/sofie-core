import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { ManualPromise, createManualPromise } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { QueueScheduler, WorkerOptions, Worker } from 'bullmq'
import { startTransaction } from '../profiler'
import { ChangeStream, ChangeStreamDocument, MongoClient } from 'mongodb'
import { createInvalidateWorkerDataCache, InvalidateWorkerDataCache } from './caches'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { logger } from '../logging'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { LocksManager } from '../locks'
import { AnyLockEvent } from './locks'
import { Observable } from 'threads/observable'

export abstract class WorkerParentBase {
	readonly #workerId: string
	readonly #studioId: StudioId

	readonly #mongoClient: MongoClient
	readonly #locksManager: LocksManager

	#terminate: ManualPromise<void> | undefined

	readonly #queue: Worker
	readonly #scheduler: QueueScheduler

	readonly #streams: Array<ChangeStream<any>> = []

	#pendingInvalidations: InvalidateWorkerDataCache | null = null

	protected constructor(
		workerId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		options: WorkerOptions
	) {
		this.#workerId = workerId
		this.#studioId = studioId
		this.#mongoClient = mongoClient
		this.#locksManager = locksManager

		this.#queue = new Worker(queueName, undefined, options)

		// This is needed to handle timeouts or something
		this.#scheduler = new QueueScheduler(queueName, options)
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

		// TODO - maybe these should be shared across threads, as there will be a bunch looking for the exact same changes..
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
			database.collection(CollectionName.Blueprints).watch(
				[
					// TODO - can/should this be scoped down at all?
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
	/** Get the lock change request event queue for the worker thread */
	public abstract workerLockEvents(): Observable<AnyLockEvent>

	/** Start the loop feeding work to the worker */
	protected startWorkerLoop(mongoUri: string, dbName: string): void {
		setImmediate(async () => {
			try {
				this.#pendingInvalidations = null

				this.subscribeToCacheInvalidations(dbName)

				// Start the worker running
				await this.initWorker(mongoUri, dbName, this.#studioId)
				await this.#locksManager.subscribe(this)

				// Run until told to terminate
				while (!this.#terminate) {
					const job = await this.#queue.getNextJob(this.#workerId, {
						// block: true, // wait for there to be a job ready
					})

					// Handle any invalidations
					if (this.#pendingInvalidations) {
						const invalidations = this.#pendingInvalidations
						this.#pendingInvalidations = null

						await this.invalidateWorkerCaches(invalidations)
					}

					// TODO - job lock may timeout, we need to run at an interval to make sure it doesnt
					// TODO - enforce a timeout? we could kill the thread once it reaches the limit as a hard abort

					// we may not get a job even when blocking, so try again
					if (job) {
						// Ensure the lock is still good
						await job.extendLock(this.#workerId, 30000) // TODO - what should the lock duration be?

						const transaction = startTransaction(job.name, 'worker-studio-parent')
						if (transaction) {
							transaction.setLabel('studioId', unprotectString(this.#studioId))
						}

						try {
							console.log('Running work ', job.id, job.name, JSON.stringify(job.data))

							// TODO - we should call extendLock on an interval with a fairly low duration
							// TODO - this never resolves if the worker dies. Hopefully the bug will be fixed, or swap it out for threadedclass https://github.com/andywer/threads.js/issues/386
							const result = await this.runJobInWorker(job.name, job.data)

							await job.moveToCompleted(result, this.#workerId, false)
						} catch (e) {
							console.log('job errored', e)
							// stringify the error to preserve the UserError
							const e2 = e instanceof Error ? e : new Error(UserError.toJSON(e))

							await job.moveToFailed(e2, this.#workerId)
						}
						console.log('the end')
						transaction?.end()
					}
				}

				// Mark completed
				this.#terminate.manualResolve()
			} catch (e) {
				// TODO - report error

				await this.#locksManager.unsubscribe(this)

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
		await this.#locksManager.unsubscribe(this)

		if (!this.#terminate) {
			this.#terminate = createManualPromise()
		}
		// wait for the work loop to exit
		await this.#terminate

		// stop the thread
		await this.terminateWorkerThread()

		await Promise.all(this.#streams.map((s) => s.close()))

		await this.#queue.close()
		await this.#scheduler.close()
	}
}
