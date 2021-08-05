import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { ManualPromise, createManualPromise } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueScheduler, WorkerOptions, Worker } from 'bullmq'
import { spawn, Worker as ThreadWorker, ModuleThread, Thread } from 'threads'
import { startTransaction } from '../../profiler'
import { StudioMethods } from './child'
import { ChangeStream, ChangeStreamDocument, MongoClient } from 'mongodb'
import { InvalidateWorkerDataCache } from '../caches'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { logger } from '../../logging'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'

export class StudioWorkerParent {
	readonly #workerId: string
	readonly #studioId: StudioId

	readonly #mongoClient: MongoClient
	readonly #worker: ModuleThread<StudioMethods>

	#terminate: ManualPromise<void> | undefined

	readonly #queue: Worker
	readonly #scheduler: QueueScheduler

	readonly #streams: Array<ChangeStream<any>> = []

	private constructor(
		workerId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		worker: ModuleThread<StudioMethods>,
		options: WorkerOptions
	) {
		this.#workerId = workerId
		this.#studioId = studioId
		this.#mongoClient = mongoClient
		this.#worker = worker

		this.#queue = new Worker(getStudioQueueName(studioId), undefined, options)

		// This is needed to handle timeouts or something
		this.#scheduler = new QueueScheduler(getStudioQueueName(studioId), options)
	}

	static async start(
		workerId: string,
		mongoUri: string,
		mongoDb: string,
		mongoClient: MongoClient,
		studioId: StudioId,
		options: WorkerOptions
	): Promise<StudioWorkerParent> {
		const studioWorker = await spawn<StudioMethods>(new ThreadWorker('./child'))

		// TODO - do more with the events
		Thread.events(studioWorker).subscribe((event) => console.log('Thread event:', event))

		// create and start the worker
		const parent = new StudioWorkerParent(workerId, studioId, mongoClient, studioWorker, options)
		parent.run(mongoUri, mongoDb)
		return parent
	}

	private run(mongoUri: string, mongoDb: string): void {
		setImmediate(async () => {
			try {
				// Start watching for cache invalidations
				let hasInvalidation = false
				let invalidations: InvalidateWorkerDataCache = {
					studio: false,
					blueprints: [],
				}

				const attachChangesStream = <T>(
					stream: ChangeStream<T>,
					name: string,
					fcn: (change: ChangeStreamDocument<T>) => void
				): void => {
					this.#streams.push(stream)
					stream.on('change', (change) => {
						// we have a change to flag
						hasInvalidation = true
						fcn(change as ChangeStreamDocument<T>)
					})
					stream.on('end', () => {
						logger.warn(`Changes stream for ${name} ended`)
						if (!this.#terminate) this.#terminate = createManualPromise()
					})
				}

				// TODO - maybe these should be shared across threads, as there will be a bunch looking for the exact same changes..
				const database = this.#mongoClient.db(mongoDb)
				attachChangesStream<DBStudio>(
					database.collection(CollectionName.Studios).watch([{ $match: { _id: this.#studioId } }], {
						batchSize: 1,
					}),
					`Studio "${this.#studioId}"`,
					() => {
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
					(change) => {
						if (change.documentKey) {
							invalidations.blueprints.push(change.documentKey)
						}
					}
				)

				// Start the worker running
				await this.#worker.init(mongoUri, mongoDb, this.#studioId)

				// TODO - clear worker caches

				// Run until told to terminate
				while (!this.#terminate) {
					const job = await this.#queue.getNextJob(this.#workerId, {
						// block: true, // wait for there to be a job ready
					})

					// Handle any invalidations
					if (hasInvalidation) {
						const invalidations2 = invalidations
						invalidations = { studio: false, blueprints: [] }

						await this.#worker.invalidateCaches(invalidations2)
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
							const result = await this.#worker.runJob(job.name, job.data)

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

				// Ensure the termination is tracked
				if (!this.#terminate) {
					this.#terminate = createManualPromise()
				}

				// Mark completed
				this.#terminate.manualResolve()
			}
		})
	}

	async terminate(): Promise<void> {
		if (!this.#terminate) {
			this.#terminate = createManualPromise()
		}
		// wait for the work loop to exit
		await this.#terminate

		// stop the thread
		await Thread.terminate(this.#worker)

		await Promise.all(this.#streams.map((s) => s.close()))

		await this.#queue.close()
		await this.#scheduler.close()
	}
}
