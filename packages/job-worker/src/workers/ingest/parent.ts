import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { QueueOptions, WorkerOptions } from 'bullmq'
import { IngestWorkerChild } from './child'
import { MongoClient } from 'mongodb'
import { InvalidateWorkerDataCache } from '../caches'
import { LocksManager } from '../../locks'
import { WorkerParentBase } from '../parent-base'
import { AnyLockEvent } from '../locks'
import { getIngestQueueName } from '@sofie-automation/corelib/dist/worker/ingest'
import { Promisify, threadedClass, ThreadedClassManager } from 'threadedclass'

export class IngestWorkerParent extends WorkerParentBase {
	readonly #thread: Promisify<IngestWorkerChild>

	private constructor(
		workerId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		options: WorkerOptions,
		thread: Promisify<IngestWorkerChild>
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
		options: WorkerOptions,
		publishQueueOptions: QueueOptions
	): Promise<IngestWorkerParent> {
		const workerThread = await threadedClass<IngestWorkerChild, typeof IngestWorkerChild>(
			'./child',
			'IngestWorkerChild',
			[],
			{
				instanceName: `Ingest: ${studioId}`,
			}
		)

		// TODO: Worker - do more with the events
		// Thread.events(workerThread).subscribe((event) => console.log('Thread event:', event))

		// create and start the worker
		const parent = new IngestWorkerParent(
			workerId,
			studioId,
			mongoClient,
			locksManager,
			getIngestQueueName(studioId),
			options,
			workerThread
		)
		parent.startWorkerLoop(mongoUri, mongoDb, publishQueueOptions)
		return parent
	}

	protected async initWorker(
		mongoUri: string,
		dbName: string,
		publishQueueOptions: QueueOptions,
		studioId: StudioId
	): Promise<void> {
		return this.#thread.init(mongoUri, dbName, publishQueueOptions, studioId, (event: AnyLockEvent) =>
			this.emit('lock', event)
		)
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
