import { JobContext } from '../jobs'
import { expose } from 'threads/worker'
import { ingestJobHandlers } from '../jobs/ingest-jobs'
import { BlueprintId, RundownId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { createMongoConnection, getMongoCollections } from '../db'
import { IDirectCollections } from '../collection'
import {
	loadBlueprintById,
	loadStudioBlueprint,
	WrappedShowStyleBlueprint,
	WrappedStudioBlueprint,
} from '../blueprints/cache'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintManifestType } from '../../../blueprints-integration/dist'
import { ReadonlyDeep } from 'type-fest'
import { setupApmAgent, startTransaction } from '../profiler'

interface StaticData {
	readonly mongoClient: MongoClient
	readonly collections: IDirectCollections

	readonly studioId: StudioId
	readonly rundownId: RundownId

	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>
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

		const blueprintId: BlueprintId = protectString('distriktsnyheter0')
		const showStyleBlueprint = await loadBlueprintById(collections, blueprintId) // HACK
		if (!showStyleBlueprint || showStyleBlueprint.blueprintType !== BlueprintManifestType.SHOWSTYLE)
			throw new Error('Missing showstyle blueprint')

		staticData = {
			mongoClient,
			collections,

			studioId,
			rundownId,

			studioBlueprint,
			showStyleBlueprint: { blueprint: showStyleBlueprint, blueprintId },
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
			const context: JobContext = Object.seal({
				directCollections: staticData.collections,

				studioId: staticData.studioId,

				studioBlueprint: staticData.studioBlueprint,
				showStyleBlueprint: staticData.showStyleBlueprint,

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
