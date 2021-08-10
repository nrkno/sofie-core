import { expose } from 'threads/worker'
import { studioJobHandlers } from './jobs'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections, IDirectCollections } from '../../db'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupApmAgent, startTransaction } from '../../profiler'
import { ISettings, DEFAULT_SETTINGS } from '@sofie-automation/corelib/dist/settings'
import { InvalidateWorkerDataCache, invalidateWorkerDataCache, loadWorkerDataCache, WorkerDataCache } from '../caches'
import { JobContextBase } from '../context'
import { Observable } from 'threads/observable'
import { AnyLockEvent, LocksManager } from '../locks'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: Readonly<IDirectCollections>

	readonly dataCache: WorkerDataCache

	readonly locks: LocksManager
}
let staticData: StaticData | undefined

setupApmAgent()

const studioMethods = {
	async init(mongoUri: string, dbName: string, studioId: StudioId): Promise<void> {
		if (staticData) throw new Error('Worker already initialised')

		const mongoClient = await createMongoConnection(mongoUri)
		const collections = getMongoCollections(mongoClient, dbName)

		// Load some 'static' data from the db
		const dataCache = await loadWorkerDataCache(
			{
				/* TODO */
			},
			collections,
			studioId
		)

		const locks = new LocksManager()

		staticData = {
			mongoClient,
			collections,

			dataCache,

			locks,
		}
	},
	observelockEvents(): Observable<AnyLockEvent> {
		if (!staticData) throw new Error('Worker not initialised')
		return staticData.locks.lockEvents
	},
	async lockChange(lockId: string, locked: boolean): Promise<void> {
		if (!staticData) throw new Error('Worker not initialised')

		staticData.locks.changeEvent(lockId, locked)
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
		const start = Date.now()

		if (!staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction(jobName, 'worker-studio')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(staticData.dataCache.studio._id))
		}

		const settings = Object.freeze<ISettings>({
			...DEFAULT_SETTINGS,
		})

		const context = new JobContextBase(
			staticData.collections,
			settings,
			staticData.dataCache,
			staticData.locks,
			transaction
		)

		try {
			// Execute function, or fail if no handler
			const handler = (studioJobHandlers as any)[jobName]
			if (handler) {
				const res = await handler(context, data)
				// explicitly await, to force the promise to resolve before the apm transaction is terminated
				return res
			} else {
				throw new Error(`Unknown job name: "${jobName}"`)
			}
		} finally {
			await context.cleanupResources()

			transaction?.end()

			console.log(`I TOOK ${Date.now() - start}ms for ${jobName}`)
		}
	},
}

export type StudioMethods = typeof studioMethods

expose(studioMethods)
