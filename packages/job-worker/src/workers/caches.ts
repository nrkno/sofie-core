import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { loadBlueprintById, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { IDirectCollections } from '../db'
import {
	BlueprintId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config'
import { Queue, QueueOptions } from 'bullmq'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { getIngestQueueName } from '@sofie-automation/corelib/dist/worker/ingest'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { DefaultStudioBlueprint } from '../blueprints/defaults/studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'

export interface WorkerDataCache {
	studio: ReadonlyDeep<DBStudio>
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	studioBlueprintConfig: ProcessedStudioConfig | undefined

	showStyleBases: Map<ShowStyleBaseId, ReadonlyDeep<DBShowStyleBase> | null> // null when not found
	showStyleVariants: Map<ShowStyleVariantId, ReadonlyDeep<DBShowStyleVariant> | null> // null when not found
	showStyleBlueprints: Map<BlueprintId, ReadonlyDeep<WrappedShowStyleBlueprint> | null> // null when not found
	showStyleBlueprintConfig: Map<BlueprintId, ProcessedShowStyleConfig>

	studioQueue: Queue
	ingestQueue: Queue
	eventsQueue: Queue
}

export interface InvalidateWorkerDataCache {
	studio: boolean
	blueprints: Array<BlueprintId>
}

export function createInvalidateWorkerDataCache(): InvalidateWorkerDataCache {
	return {
		studio: false,
		blueprints: [],
	}
}

export async function loadWorkerDataCache(
	queueOptions: QueueOptions,
	collections: Readonly<IDirectCollections>,
	studioId: StudioId
): Promise<WorkerDataCache> {
	// Load some 'static' data from the db
	const studio = deepFreeze(await collections.Studios.findOne(studioId))
	if (!studio) throw new Error('Missing studio')
	const studioBlueprint = deepFreeze(await loadStudioBlueprintOrPlaceholder(collections, studio)) // TODO: Worker - guard against errors?

	return {
		studio,
		studioBlueprint,
		studioBlueprintConfig: undefined,

		showStyleBases: new Map(),
		showStyleVariants: new Map(),
		showStyleBlueprints: new Map(),
		showStyleBlueprintConfig: new Map(),

		studioQueue: new Queue(getStudioQueueName(studioId), queueOptions),
		ingestQueue: new Queue(getIngestQueueName(studioId), queueOptions),
		eventsQueue: new Queue(getEventsQueueName(studioId), queueOptions),
	}
}

export async function invalidateWorkerDataCache(
	collections: Readonly<IDirectCollections>,
	cache: WorkerDataCache,
	data: InvalidateWorkerDataCache
): Promise<void> {
	let updateStudioBlueprint = false

	if (data.studio) {
		const newStudio = await collections.Studios.findOne(cache.studio._id)
		if (!newStudio) throw new Error(`Studio is missing during cache invalidation!`)

		// If studio blueprintId changed, then force it to be reloaded
		if (newStudio.blueprintId !== cache.studio.blueprintId) updateStudioBlueprint = true

		cache.studio = deepFreeze(newStudio)
		cache.studioBlueprintConfig = undefined
	}

	// Check if studio blueprint was in the changed list
	if (!updateStudioBlueprint && cache.studio.blueprintId) {
		updateStudioBlueprint = data.blueprints.includes(cache.studio.blueprintId)
	}

	// Reload studioBlueprint
	if (updateStudioBlueprint) {
		cache.studioBlueprint = deepFreeze(await loadStudioBlueprintOrPlaceholder(collections, cache.studio)) // TODO: Worker - guard against errors?
		cache.studioBlueprintConfig = undefined
	}

	if (data.studio) {
		// Ensure showStyleBases & showStyleVariants are all still valid for the studio
		const allowedBases = new Set(cache.studio.supportedShowStyleBase)

		for (const id of Array.from(cache.showStyleBases.keys())) {
			if (!allowedBases.has(id)) {
				cache.showStyleBases.delete(id)
			}
		}

		for (const [id, v] of Array.from(cache.showStyleVariants.entries())) {
			if (v === null || !allowedBases.has(v.showStyleBaseId)) {
				cache.showStyleVariants.delete(id)
			}
		}

		// // Unload any unreferenced blueprints
		// const validShowStyleBlueprints = new Set<BlueprintId>()
		// for (const showStyleBase of cache.showStyleBases) {
		// 	if (showStyleBase[1]) {
		// 		validShowStyleBlueprints.add(showStyleBase[1].blueprintId)
		// 	}
		// }

		// TODO: Worker - can we delete any blueprints. be gentle, we could have briefly unloaded the showStyleBase that referenced them
	}
	// TODO: Worker - handle showStyleBases & showStyleVariants changes

	// TODO: Worker - showStyleBlueprints on change

	// TODO: Worker - showStyleBlueprints inactivity timeout?
	// TODO: Worker - showStyleBlueprintConfig cleanup
}

async function loadStudioBlueprintOrPlaceholder(
	collections: IDirectCollections,
	studio: ReadonlyDeep<DBStudio>
): Promise<WrappedStudioBlueprint> {
	if (!studio.blueprintId) {
		return {
			blueprintId: protectString('__placeholder__'),
			blueprint: DefaultStudioBlueprint,
		}
	}

	const blueprintManifest = await loadBlueprintById(collections, studio.blueprintId)
	if (!blueprintManifest) {
		throw new Error(`Blueprint "${studio.blueprintId}" not found! (referenced by Studio "${studio._id}")`)
	}

	if (blueprintManifest.blueprintType !== BlueprintManifestType.STUDIO) {
		throw new Error(
			`Blueprint "${studio.blueprintId}" is not valid for a Studio "${studio._id}" (${blueprintManifest.blueprintType})!`
		)
	}

	return {
		blueprintId: studio.blueprintId,
		blueprint: blueprintManifest,
	}
}
