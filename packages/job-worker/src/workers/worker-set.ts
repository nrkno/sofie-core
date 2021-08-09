import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { LocksManager } from '../locks'
import { IngestWorkerParent } from './ingest/parent'
import { StudioWorkerParent } from './studio/parent'
import { WorkerOptions } from 'bullmq'

export class StudioWorkerSet {
	#workerId: string
	#mongoUri: string
	#dbName: string
	#mongoClient: MongoClient
	#workerOptions: WorkerOptions

	#studioId: StudioId

	#locksManager: LocksManager
	#studioWorker!: StudioWorkerParent
	#ingestWorker!: IngestWorkerParent

	constructor(
		workerId: string,
		mongoUri: string,
		dbName: string,
		mongoClient: MongoClient,
		studioId: StudioId,
		workerOptions: WorkerOptions
	) {
		this.#workerId = workerId
		this.#mongoUri = mongoUri
		this.#dbName = dbName
		this.#mongoClient = mongoClient
		this.#studioId = studioId
		this.#workerOptions = workerOptions

		this.#locksManager = new LocksManager()
	}

	public static async create(
		workerId: string,
		mongoUri: string,
		dbName: string,
		mongoClient: MongoClient,
		studioId: StudioId,
		workerOptions: WorkerOptions
	): Promise<StudioWorkerSet> {
		const result = new StudioWorkerSet(workerId, mongoUri, dbName, mongoClient, studioId, workerOptions)

		await Promise.all([result.initStudioThread(), result.initIngestThread()])

		return result
	}

	private async initStudioThread(): Promise<void> {
		// Note: if this times out, try setting THREADS_WORKER_INIT_TIMEOUT=30000
		this.#studioWorker = await StudioWorkerParent.start(
			this.#workerId,
			this.#mongoUri,
			this.#dbName,
			this.#mongoClient,
			this.#locksManager,
			this.#studioId,
			this.#workerOptions
		)

		// TODO - listen for termination?
	}

	private async initIngestThread(): Promise<void> {
		// Note: if this times out, try setting THREADS_WORKER_INIT_TIMEOUT=30000
		this.#ingestWorker = await IngestWorkerParent.start(
			this.#workerId,
			this.#mongoUri,
			this.#dbName,
			this.#mongoClient,
			this.#locksManager,
			this.#studioId,
			this.#workerOptions
		)

		// TODO - listen for termination?
	}

	public async terminate(): Promise<void> {
		await Promise.allSettled([this.#studioWorker.terminate(), this.#ingestWorker.terminate()])
	}
}
