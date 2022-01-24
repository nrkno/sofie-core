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
import { DefaultStudioBlueprint } from '../blueprints/defaults/studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'

export interface WorkerDataCache {
	studio: ReadonlyDeep<DBStudio>
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	studioBlueprintConfig: ProcessedStudioConfig | undefined

	showStyleBases: Map<ShowStyleBaseId, ReadonlyDeep<DBShowStyleBase> | null> // null when not found
	showStyleVariants: Map<ShowStyleVariantId, ReadonlyDeep<DBShowStyleVariant> | null> // null when not found
	showStyleBlueprints: Map<BlueprintId, ReadonlyDeep<WrappedShowStyleBlueprint> | null> // null when not found
	showStyleBlueprintConfig: Map<ShowStyleVariantId, ProcessedShowStyleConfig>
}

export interface InvalidateWorkerDataCache {
	forceAll: boolean
	studio: boolean
	blueprints: Array<BlueprintId>
	showStyleBases: Array<ShowStyleBaseId>
	showStyleVariants: Array<ShowStyleVariantId>
}

export function createInvalidateWorkerDataCache(): InvalidateWorkerDataCache {
	return {
		forceAll: false,
		studio: false,
		blueprints: [],
		showStyleBases: [],
		showStyleVariants: [],
	}
}

export async function loadWorkerDataCache(
	// queueOptions: QueueOptions,
	collections: Readonly<IDirectCollections>,
	studioId: StudioId
): Promise<WorkerDataCache> {
	// Load some 'static' data from the db
	const studio = deepFreeze(await collections.Studios.findOne(studioId))
	if (!studio) throw new Error('Missing studio')
	const studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, studio)

	return {
		studio,
		studioBlueprint,
		studioBlueprintConfig: undefined,

		showStyleBases: new Map(),
		showStyleVariants: new Map(),
		showStyleBlueprints: new Map(),
		showStyleBlueprintConfig: new Map(),
	}
}

export async function invalidateWorkerDataCache(
	collections: Readonly<IDirectCollections>,
	cache: WorkerDataCache,
	data: InvalidateWorkerDataCache
): Promise<void> {
	if (data.forceAll) {
		// Clear everything!

		const newStudio = await collections.Studios.findOne(cache.studio._id)
		if (!newStudio) throw new Error(`Studio is missing during cache invalidation!`)
		cache.studio = deepFreeze(newStudio)

		cache.studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, cache.studio)
		cache.studioBlueprintConfig = undefined

		cache.showStyleBases.clear()
		cache.showStyleVariants.clear()
		cache.showStyleBlueprints.clear()
		cache.showStyleBlueprintConfig.clear()

		return
	}

	let updateStudioBlueprint = false

	if (data.studio) {
		logger.debug('WorkerDataCache: Reloading studio')
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
		logger.debug('WorkerDataCache: Reloading studioBlueprint')
		cache.studioBlueprint = await loadStudioBlueprintOrPlaceholder(collections, cache.studio)
		cache.studioBlueprintConfig = undefined
	}

	const purgeShowStyleVariants = (keep: (variant: ReadonlyDeep<DBShowStyleVariant>) => boolean) => {
		for (const [id, v] of Array.from(cache.showStyleVariants.entries())) {
			if (v === null || !keep(v)) {
				logger.debug(`WorkerDataCache: Discarding ShowStyleVariant "${id}"`)
				cache.showStyleVariants.delete(id)
				cache.showStyleBlueprintConfig.delete(id)
			}
		}
	}

	if (data.studio) {
		// Ensure showStyleBases & showStyleVariants are all still valid for the studio
		const allowedBases = new Set(cache.studio.supportedShowStyleBase)

		for (const id of Array.from(cache.showStyleBases.keys())) {
			if (!allowedBases.has(id)) {
				logger.debug(`WorkerDataCache: Discarding showStyleBase "${id}"`)
				cache.showStyleBases.delete(id)
			}
		}

		purgeShowStyleVariants((v) => allowedBases.has(v.showStyleBaseId))

		// Blueprints get cleaned up at the end
	}

	// Future: inactivity timeout for everything/anything showstyle?
	// Future: this is all a bit too agressive, it would be better to have a grace period as it likely that the owning ShowStyleBase will be reloaded soon

	// Purge any ShowStyleBase (and its Variants) that has changes
	for (const id of data.showStyleBases) {
		logger.debug(`WorkerDataCache: Discarding showStyleBase "${id}"`)
		cache.showStyleBases.delete(id)

		purgeShowStyleVariants((v) => v.showStyleBaseId !== id)
	}

	// Purge any ShowtStyleVariant that has changes
	if (data.showStyleVariants.length > 0) {
		const variantIds = new Set(data.showStyleVariants)
		purgeShowStyleVariants((v) => !variantIds.has(v._id))
	}

	{
		// Clear out any currently unreferenced blueprints
		const allowedBlueprints = new Set<BlueprintId>()
		for (const showStyleBase of cache.showStyleBases.values()) {
			if (showStyleBase) {
				allowedBlueprints.add(showStyleBase.blueprintId)
			}
		}
		const removedBlueprints = new Set<BlueprintId>()
		for (const id of cache.showStyleBlueprints.keys()) {
			if (!allowedBlueprints.has(id)) {
				logger.debug(`WorkerDataCache: Discarding unreferenced Blueprint "${id}"`)

				cache.showStyleBlueprints.delete(id)
				removedBlueprints.add(id)
			}
		}
		// Clear out changed blueprints
		for (const id of data.blueprints) {
			logger.debug(`WorkerDataCache: Discarding changed Blueprint "${id}"`)

			cache.showStyleBlueprints.delete(id)
			removedBlueprints.add(id)
		}

		if (removedBlueprints.size > 0) {
			const cleanupBases = new Set<ShowStyleBaseId>()

			// Figure out which bases used the blueprint
			for (const [baseId, base] of cache.showStyleBases.entries()) {
				if (base && removedBlueprints.has(base.blueprintId)) {
					cleanupBases.add(baseId)
				}
			}

			if (cleanupBases.size > 0) {
				for (const [variantId, variant] of cache.showStyleVariants.entries()) {
					if (variant && cleanupBases.has(variant.showStyleBaseId)) {
						logger.debug(`WorkerDataCache: Discarding cached config for ShowStyleVariant "${variantId}"`)
						cache.showStyleBlueprintConfig.delete(variantId)
					}
				}
			}
		}
	}
}

async function loadStudioBlueprintOrPlaceholder(
	collections: IDirectCollections,
	studio: ReadonlyDeep<DBStudio>
): Promise<ReadonlyDeep<WrappedStudioBlueprint>> {
	if (!studio.blueprintId) {
		return Object.freeze({
			blueprintId: protectString('__placeholder__'),
			blueprint: DefaultStudioBlueprint,
		})
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

	return Object.freeze({
		blueprintId: studio.blueprintId,
		blueprint: blueprintManifest,
	})
}
