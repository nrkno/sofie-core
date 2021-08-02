import { JobContext } from '../../jobs'
import { expose } from 'threads/worker'
import { ingestJobHandlers } from './jobs'
import { RundownId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections } from '../../db'
import { IDirectCollections } from '../../collection'
import { loadStudioBlueprint, WrappedStudioBlueprint } from '../../blueprints/cache'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { setupApmAgent, startTransaction } from '../../profiler'
import { DEFAULT_SETTINGS, ISettings } from '@sofie-automation/corelib/dist/settings'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: IDirectCollections

	readonly studioId: StudioId
	readonly rundownId: RundownId

	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
}
let staticData: StaticData | undefined

setupApmAgent()

const ingestMethods = {
	async init(mongoUri: string, mongoDb: string, studioId: StudioId, rundownId: RundownId): Promise<void> {
		if (staticData) throw new Error('Worker already initialised')

		const mongoClient = await createMongoConnection(mongoUri)
		const collections = getMongoCollections(mongoClient, mongoDb)

		// Load some 'static' data from the db
		// TODO most of this can be cached, but needs invalidation..
		const tmpStudio = await collections.Studios.findOne(studioId)
		if (!tmpStudio) throw new Error('Missing studio')
		const studioBlueprint = await loadStudioBlueprint(collections, tmpStudio)
		if (!studioBlueprint) throw new Error('Missing studio blueprint')

		staticData = {
			mongoClient,
			collections,

			studioId,
			rundownId,

			studioBlueprint,
		}
	},
	async runJob(jobName: string, data: unknown): Promise<unknown> {
		if (!staticData) throw new Error('Worker not initialised')

		const transaction = startTransaction(jobName, 'worker-ingest')
		if (transaction) {
			transaction.setLabel('studioId', unprotectString(staticData.studioId))
			transaction.setLabel('rundownId', unprotectString(staticData.rundownId))
		}

		try {
			const context = Object.seal<JobContext>({
				directCollections: staticData.collections,

				studioId: staticData.studioId,

				studioBlueprint: staticData.studioBlueprint,

				settings: Object.seal<ISettings>({
					...DEFAULT_SETTINGS,
				}),

				startSpan: (spanName: string) => {
					if (transaction) return transaction.startSpan(spanName)
					return null
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
