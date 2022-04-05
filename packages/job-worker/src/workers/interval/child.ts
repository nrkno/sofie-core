import { intervalJobHandlers } from './jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import { InvalidateWorkerDataCache, invalidateWorkerDataCache, loadWorkerDataCache, WorkerDataCache } from '../caches'
import { JobContextImpl, QueueJobFunc } from '../context'
import { AnyLockEvent, LocksManager } from '../locks'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main'
import { interceptLogging, logger } from '../../logging'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { setupInfluxDb } from '../../influx'
import { getIntervalQueueName } from '@sofie-automation/corelib/dist/worker/interval'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: Readonly<IDirectCollections>

	readonly dataCache: WorkerDataCache

	// readonly locks: LocksManager
}

export class IntervalWorkerChild {
	#staticData: StaticData | undefined

	readonly #studioId: StudioId
	readonly #locks: LocksManager
	readonly #queueJob: QueueJobFunc
	readonly #fastTrackTimeline: FastTrackTimelineFunc | null

	constructor(
		studioId: StudioId,
		emitLockEvent: (event: AnyLockEvent) => Promise<void>,
		queueJob: QueueJobFunc,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null
	) {
		// Intercept logging to pipe back over ipc
		interceptLogging(getIntervalQueueName(studioId), logLine)

		setupApmAgent()
		setupInfluxDb()

		this.#locks = new LocksManager(emitLockEvent)
		this.#queueJob = queueJob
		this.#fastTrackTimeline = fastTrackTimeline
		this.#studioId = studioId
	}

	async init(mongoUri: string, dbName: string): Promise<void> {
		if (this.#staticData) throw new Error('Worker already initialised')

		const mongoClient = await createMongoConnection(mongoUri)
		const collections = getMongoCollections(mongoClient, dbName)

		// Load some 'static' data from the db
		const dataCache = await loadWorkerDataCache(collections, this.#studioId)

		this.#staticData = {
			mongoClient,
			collections,

			dataCache,
		}

		logger.info(`Interval thread for ${this.#studioId} initialised`)
	}
	async lockChange(lockId: string, locked: boolean): Promise<void> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		this.#locks.changeEvent(lockId, locked)
	}
	async invalidateCaches(data: InvalidateWorkerDataCache): Promise<void> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction('invalidateCaches', 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#staticData.dataCache.studio._id))
		}

		try {
			await invalidateWorkerDataCache(this.#staticData.collections, this.#staticData.dataCache, data)
		} finally {
			transaction?.end()
		}
	}
	async runJob(jobName: string, data: unknown): Promise<unknown> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction(jobName, 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#staticData.dataCache.studio._id))
		}

		const context = new JobContextImpl(
			this.#staticData.collections,
			this.#staticData.dataCache,
			this.#locks,
			transaction,
			this.#queueJob,
			this.#fastTrackTimeline
		)

		try {
			// Execute function, or fail if no handler
			const handler = (intervalJobHandlers as any)[jobName]
			if (handler) {
				const res = await handler(context, data)
				// explicitly await, to force the promise to resolve before the apm transaction is terminated
				return res
			} else {
				throw new Error(`Unknown job name: "${jobName}"`)
			}
		} catch (e) {
			logger.error(`Interval job errored: ${stringifyError(e)}`)
			throw e
		} finally {
			await context.cleanupResources()

			transaction?.end()
		}
	}
}
