import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { ManualPromise, createManualPromise } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueScheduler, WorkerOptions, Worker } from 'bullmq'
import { spawn, Worker as ThreadWorker } from 'threads'
import { startTransaction } from '../../profiler'
import { ModuleThread, Thread } from 'threads'
import { StudioMethods } from '.'

export class StudioWorkerParent {
	readonly #workerId: string
	readonly #studioId: StudioId

	readonly #worker: ModuleThread<StudioMethods>

	#terminate: ManualPromise<void> | undefined

	readonly #queue: Worker
	readonly #scheduler: QueueScheduler

	private constructor(
		worker: ModuleThread<StudioMethods>,
		workerId: string,
		studioId: StudioId,
		options: WorkerOptions
	) {
		this.#workerId = workerId
		this.#studioId = studioId
		this.#worker = worker

		this.#queue = new Worker(getStudioQueueName(studioId), undefined, options)

		// This is needed to handle timeouts or something
		this.#scheduler = new QueueScheduler(getStudioQueueName(studioId), options)
	}

	static async start(workerId: string, studioId: StudioId, options: WorkerOptions): Promise<StudioWorkerParent> {
		const studioWorker = await spawn<StudioMethods>(new ThreadWorker('./workers/studio'))

		// TODO - do more with the events
		Thread.events(studioWorker).subscribe((event) => console.log('Thread event:', event))

		// create and start the worker
		const parent = new StudioWorkerParent(studioWorker, workerId, studioId, options)
		parent.run()
		return parent
	}

	private run(): void {
		setImmediate(async () => {
			try {
				// Start watching for cache invalidations

				// Run until told to terminate
				while (!this.#terminate) {
					const job = await this.#queue.getNextJob(this.#workerId, {
						// block: true, // wait for there to be a job ready
					})

					// TODO - job lock may timeout, we need to run at an interval to make sure it doesnt
					// TODO - enforce a timeout? we could kill the thread once it reaches the limit as a hard abort

					// we may not get a job even when blocking, so try again
					if (job) {
						const transaction = startTransaction(job.name, 'worker-studio-parent')
						if (transaction) {
							transaction.setLabel('studioId', unprotectString(this.#studioId))
						}

						try {
							console.log('Running work ', job.id, job.name, JSON.stringify(job.data))

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

		await this.#queue.close()
		await this.#scheduler.close()
	}
}
