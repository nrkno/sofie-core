import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { WorkerOptions } from 'bullmq'
import { spawn, Worker as ThreadWorker, ModuleThread, Thread } from 'threads'
import { StudioMethods } from './child'
import { MongoClient } from 'mongodb'
import { InvalidateWorkerDataCache } from '../caches'
import { LocksManager } from '../../locks'
import { WorkerParentBase } from '../parent-base'
import { AnyLockEvent } from '../locks'
import { Observable } from 'threads/observable'

export class StudioWorkerParent extends WorkerParentBase {
	readonly #thread: ModuleThread<StudioMethods>

	private constructor(
		workerId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		options: WorkerOptions,
		thread: ModuleThread<StudioMethods>
	) {
		super(workerId, studioId, mongoClient, locksManager, queueName, options)

		this.#thread = thread
	}

	static async start(
		workerId: string,
		mongoUri: string,
		mongoDb: string,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		studioId: StudioId,
		options: WorkerOptions
	): Promise<StudioWorkerParent> {
		const workerThread = await spawn<StudioMethods>(new ThreadWorker('./child'))

		// TODO: Worker - do more with the events
		Thread.events(workerThread).subscribe((event) => console.log('Thread event:', event))

		// create and start the worker
		const parent = new StudioWorkerParent(
			workerId,
			studioId,
			mongoClient,
			locksManager,
			getStudioQueueName(studioId),
			options,
			workerThread
		)
		parent.startWorkerLoop(mongoUri, mongoDb)
		return parent
	}

	protected initWorker(mongoUri: string, dbName: string, studioId: StudioId): Promise<void> {
		return this.#thread.init(mongoUri, dbName, studioId)
	}
	protected invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void> {
		return this.#thread.invalidateCaches(invalidations)
	}
	protected runJobInWorker(name: string, data: any): Promise<any> {
		return this.#thread.runJob(name, data)
	}
	protected terminateWorkerThread(): Promise<void> {
		return Thread.terminate(this.#thread)
	}
	public workerLockChange(lockId: string, locked: boolean): Promise<void> {
		return this.#thread.lockChange(lockId, locked)
	}
	public workerLockEvents(): Observable<AnyLockEvent> {
		return this.#thread.observelockEvents()
	}
}
