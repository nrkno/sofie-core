import { JobContext } from '../../jobs'
import { expose } from 'threads/worker'
import { studioJobHandlers } from './jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import { ISettings, DEFAULT_SETTINGS } from '@sofie-automation/corelib/dist/settings'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { InvalidateWorkerDataCache, invalidateWorkerDataCache, loadWorkerDataCache, WorkerDataCache } from '../caches'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: Readonly<IDirectCollections>

	readonly dataCache: WorkerDataCache
}
let staticData: StaticData | undefined

setupApmAgent()

const studioMethods = {
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

		const transaction = startTransaction(jobName, 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(staticData.dataCache.studio._id))
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
			const handler = (studioJobHandlers as any)[jobName]
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

export type StudioMethods = typeof studioMethods

expose(studioMethods)
