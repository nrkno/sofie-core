import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import { InvalidateWorkerDataCache } from '../caches'
import { QueueJobFunc } from '../context'
import { AnyLockEvent } from '../locks'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main'
import { interceptLogging, logger } from '../../logging'
import { setupInfluxDb } from '../../influx'
import { getIntervalQueueName } from '@sofie-automation/corelib/dist/worker/interval'
import { ExternalMessageQueueRunner } from '../../interval/ExternalMessageQueue'
import { ReadonlyDeep } from 'type-fest'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: Readonly<IDirectCollections>

	// readonly dataCache: WorkerDataCache

	// readonly locks: LocksManager
}

export class IntervalWorkerChild {
	#staticData: StaticData | undefined

	readonly #studioId: StudioId
	// readonly #queueJob: QueueJobFunc
	#externalMessageQueue: ExternalMessageQueueRunner | undefined

	constructor(
		studioId: StudioId,
		_emitLockEvent: (event: AnyLockEvent) => Promise<void>,
		_queueJob: QueueJobFunc,
		logLine: LogLineWithSourceFunc,
		_fastTrackTimeline: FastTrackTimelineFunc | null
	) {
		// Intercept logging to pipe back over ipc
		interceptLogging(getIntervalQueueName(studioId), logLine)

		setupApmAgent()
		setupInfluxDb()

		// this.#queueJob = queueJob
		this.#studioId = studioId
	}

	async init(mongoUri: string, dbName: string): Promise<void> {
		if (this.#staticData) throw new Error('Worker already initialised')

		const mongoClient = await createMongoConnection(mongoUri)
		const collections = getMongoCollections(mongoClient, dbName)

		// // Load some 'static' data from the db
		// const dataCache = await loadWorkerDataCache(collections, this.#studioId)

		this.#staticData = {
			mongoClient,
			collections,

			// dataCache,
		}

		const database = mongoClient.db(dbName)
		this.#externalMessageQueue = await ExternalMessageQueueRunner.create(database, collections, this.#studioId)

		logger.info(`Interval thread for ${this.#studioId} initialised`)
	}
	async lockChange(_lockId: string, _locked: boolean): Promise<void> {
		// Thread does not care about locks
		throw new Error('Not supported')
	}
	async invalidateCaches(data: ReadonlyDeep<InvalidateWorkerDataCache>): Promise<void> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction('invalidateCaches', 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#studioId))
		}

		try {
			if (this.#externalMessageQueue) this.#externalMessageQueue.invalidateCaches(data)
		} finally {
			transaction?.end()
		}
	}
	async runJob(jobName: string, _data: unknown): Promise<unknown> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction(jobName, 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#studioId))
		}

		throw new Error('Not implemented')
		// const context = new JobContextImpl(
		// 	this.#staticData.collections,
		// 	this.#staticData.dataCache,
		// 	this.#locks,
		// 	transaction,
		// 	this.#queueJob,
		// 	this.#fastTrackTimeline
		// )

		// try {
		// 	// Execute function, or fail if no handler
		// 	const handler = (intervalJobHandlers as any)[jobName]
		// 	if (handler) {
		// 		const res = await handler(context, data)
		// 		// explicitly await, to force the promise to resolve before the apm transaction is terminated
		// 		return res
		// 	} else {
		// 		throw new Error(`Unknown job name: "${jobName}"`)
		// 	}
		// } catch (e) {
		// 	logger.error(`Interval job errored: ${stringifyError(e)}`)
		// 	throw e
		// } finally {
		// 	await context.cleanupResources()

		// 	transaction?.end()
		// }
	}
}
