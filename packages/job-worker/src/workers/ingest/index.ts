import { JobContext } from '../../jobs'
import { expose } from 'threads/worker'
import { ingestJobHandlers } from './jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import { DEFAULT_SETTINGS, ISettings } from '@sofie-automation/corelib/dist/settings'
import { InvalidateWorkerDataCache, invalidateWorkerDataCache, loadWorkerDataCache, WorkerDataCache } from '../caches'
import { clone } from '@sofie-automation/corelib/dist/lib'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: IDirectCollections

	// readonly rundownId: RundownId

	readonly dataCache: WorkerDataCache
}
let staticData: StaticData | undefined

setupApmAgent()

const ingestMethods = {
	async init(mongoUri: string, mongoDb: string, studioId: StudioId): Promise<void> {
		if (staticData) throw new Error('Worker already initialised')

		const mongoClient = await createMongoConnection(mongoUri)
		const collections = getMongoCollections(mongoClient, mongoDb)

		// Load some 'static' data from the db
		const dataCache = await loadWorkerDataCache(collections, studioId)

		staticData = {
			mongoClient,
			collections,

			dataCache,
		}
	},
	async invalidateCaches(data: InvalidateWorkerDataCache): Promise<void> {
		if (!staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction('invalidateCaches', 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(staticData.dataCache.studio._id))
		}

		try {
			await invalidateWorkerDataCache(staticData.collections, staticData.dataCache, data)
		} finally {
			transaction?.end()
		}
	},
	async runJob(jobName: string, data: unknown): Promise<unknown> {
		if (!staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction(jobName, 'worker-ingest')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(staticData.dataCache.studio._id))
			// transaction.setLabel('rundownId', unprotectString(staticData.rundownId))
		}

		try {
			// Clone and seal to avoid mutations ()
			const studio = Object.freeze(clone(staticData.dataCache.studio))

			const context = Object.freeze<JobContext>({
				directCollections: staticData.collections,

				studioId: studio._id,
				studio: studio,

				studioBlueprint: staticData.dataCache.studioBlueprint,

				settings: Object.freeze<ISettings>({
					...DEFAULT_SETTINGS,
				}),

				startSpan: (spanName: string) => {
					if (transaction) return transaction.startSpan(spanName)
					return null
				},

				queueIngestJob: () => {
					throw new Error('Not implemented')
				},
			})

			// Execute function, or fail if no handler
			const handler = (ingestJobHandlers as any)[jobName]
			if (handler) {
				return handler(context, data)
			} else {
				throw new Error(`Unknown job name: "${jobName}"`)
			}
		} finally {
			transaction?.end()
		}
	},
}

export type IngestMethods = typeof ingestMethods

expose(ingestMethods)
