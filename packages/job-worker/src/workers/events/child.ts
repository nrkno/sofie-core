import { eventJobHandlers } from './jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import {
	InvalidateWorkerDataCache,
	invalidateWorkerDataCache,
	loadWorkerDataCache,
	WorkerDataCache,
	WorkerDataCacheWrapperImpl,
} from '../caches'
import { JobContextImpl } from '../context/JobContextImpl'
import { QueueJobFunc } from '../context/util'
import { AnyLockEvent, LocksManager } from '../locks'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main'
import { interceptLogging, logger } from '../../logging'
import { setupInfluxDb } from '../../influx'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { ExternalMessageQueueRunner } from '../../events/ExternalMessageQueue'
import { WorkerJobResult } from '../parent-base'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { getPrometheusMetricsString, setupPrometheusMetrics } from '@sofie-automation/corelib/dist/prometheus'
import { UserError } from '@sofie-automation/corelib/dist/error'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: Readonly<IDirectCollections>

	readonly dataCache: WorkerDataCache

	// readonly locks: LocksManager
}

export class EventsWorkerChild {
	#staticData: StaticData | undefined

	readonly #studioId: StudioId
	readonly #locks: LocksManager
	readonly #queueJob: QueueJobFunc
	readonly #fastTrackTimeline: FastTrackTimelineFunc | null

	#externalMessageQueue: ExternalMessageQueueRunner | undefined

	constructor(
		studioId: StudioId,
		emitLockEvent: (event: AnyLockEvent) => Promise<void>,
		queueJob: QueueJobFunc,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null
	) {
		// Intercept logging to pipe back over ipc
		interceptLogging(getEventsQueueName(studioId), logLine)
		setupPrometheusMetrics(getEventsQueueName(studioId))

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
		const collections = getMongoCollections(mongoClient, dbName, false)

		// Load some 'static' data from the db
		const dataCache = await loadWorkerDataCache(collections, this.#studioId)

		{
			const watcherCollections = getMongoCollections(mongoClient, dbName, true)
			const dataCache = await WorkerDataCacheWrapperImpl.create(watcherCollections, this.#studioId)
			this.#externalMessageQueue = await ExternalMessageQueueRunner.create(watcherCollections, dataCache)
		}

		// Now that everything is loaded, set #staticData to mark it as initialised:
		this.#staticData = {
			mongoClient,
			collections,

			dataCache,
		}

		logger.info(`Events thread for ${this.#studioId} initialised`)
	}
	async lockChange(lockId: string, locked: boolean): Promise<void> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		this.#locks.changeEvent(lockId, locked)
	}
	async invalidateCaches(data: InvalidateWorkerDataCache): Promise<void> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction('invalidateCaches', 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#staticData.dataCache.jobStudio._id))
		}

		try {
			this.#externalMessageQueue?.invalidateCaches(data)

			await invalidateWorkerDataCache(this.#staticData.collections, this.#staticData.dataCache, data)
		} finally {
			transaction?.end()
		}
	}
	async collectMetrics(): Promise<string> {
		return getPrometheusMetricsString()
	}
	async runJob(jobName: string, data: unknown): Promise<WorkerJobResult> {
		if (!this.#staticData) throw new Error('Worker not initialised')

		const trace = startTrace('studioWorker' + jobName)
		const transaction = startTransaction(jobName, 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(this.#staticData.dataCache.jobStudio._id))
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
			const handler = (eventJobHandlers as any)[jobName]
			if (handler) {
				try {
					const res = await handler(context, data)
					// explicitly await, to force the promise to resolve before the apm transaction is terminated
					return {
						result: res,
						error: null,
					}
				} catch (e) {
					const userError = UserError.fromUnknown(e)

					logger.error(`Events job "${jobName}" errored: ${userError.toErrorString()}`)

					return {
						result: null,
						error: UserError.toJSON(userError),
					}
				}
			} else {
				throw new Error(`Unknown job name: "${jobName}"`)
			}
		} finally {
			await context.cleanupResources()

			sendTrace(endTrace(trace))
			transaction?.end()
		}
	}
}
