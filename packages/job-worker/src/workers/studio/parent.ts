import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { WorkerOptions } from 'bullmq'
import type { StudioWorkerChild } from './child'
import { MongoClient } from 'mongodb'
import { InvalidateWorkerDataCache } from '../caches'
import { LocksManager } from '../../locks'
import { WorkerParentBase } from '../parent-base'
import { AnyLockEvent } from '../locks'
import { Promisify, threadedClass, ThreadedClassManager } from 'threadedclass'

export class StudioWorkerParent extends WorkerParentBase {
	readonly #thread: Promisify<StudioWorkerChild>

	private constructor(
		workerId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		options: WorkerOptions,
		thread: Promisify<StudioWorkerChild>
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
		const workerThread = await threadedClass<StudioWorkerChild, typeof StudioWorkerChild>(
			'./child',
			'StudioWorkerChild',
			[],
			{
				instanceName: `Studio: ${studioId}`,
			}
		)

		// TODO: Worker - get the events
		// Thread.events(workerThread).subscribe((event) => console.log('Thread event:', event))

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

	protected async initWorker(mongoUri: string, dbName: string, studioId: StudioId): Promise<void> {
		return this.#thread.init(mongoUri, dbName, studioId, (event: AnyLockEvent) => this.emit('lock', event))
	}
	protected async invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void> {
		return this.#thread.invalidateCaches(invalidations)
	}
	protected async runJobInWorker(name: string, data: any): Promise<any> {
		return this.#thread.runJob(name, data)
	}
	protected async terminateWorkerThread(): Promise<void> {
		return ThreadedClassManager.destroy(this.#thread)
	}
	public async workerLockChange(lockId: string, locked: boolean): Promise<void> {
		return this.#thread.lockChange(lockId, locked)
	}
}
