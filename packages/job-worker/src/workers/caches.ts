import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { loadStudioBlueprint, WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
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

export interface WorkerDataCache {
	studio: DBStudio
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	showStyleBases: Map<ShowStyleBaseId, DBShowStyleBase | null> // null when not found
	showStyleVariants: Map<ShowStyleVariantId, DBShowStyleVariant | null> // null when not found
	showStyleBlueprints: Map<BlueprintId, WrappedShowStyleBlueprint | null> // null when not found
}

export interface InvalidateWorkerDataCache {
	studio: boolean
	blueprints: Array<BlueprintId>
}

export async function loadWorkerDataCache(
	collections: Readonly<IDirectCollections>,
	studioId: StudioId
): Promise<WorkerDataCache> {
	// Load some 'static' data from the db
	const studio = await collections.Studios.findOne(studioId)
	if (!studio) throw new Error('Missing studio')
	const studioBlueprint = await loadStudioBlueprint(collections, studio)
	if (!studioBlueprint) throw new Error('Missing studio blueprint') // TODO - this can be allowed

	return {
		studio,
		studioBlueprint,

		showStyleBases: new Map(),
		showStyleVariants: new Map(),
		showStyleBlueprints: new Map(),
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

		cache.studio = newStudio
	}

	// Check if studio blueprint was in the changed list
	if (!updateStudioBlueprint && cache.studio.blueprintId) {
		updateStudioBlueprint = data.blueprints.includes(cache.studio.blueprintId)
	}

	// Reload studioBlueprint
	if (updateStudioBlueprint) {
		const newStudioBlueprint = await loadStudioBlueprint(collections, cache.studio)
		if (!newStudioBlueprint) throw new Error('Missing studio blueprint') // TODO - this can be allowed
		cache.studioBlueprint = newStudioBlueprint
	}

	// Check if studioBlueprint config should be re-processed
	if (updateStudioBlueprint || cache.studio) {
		// TODO - invalidate studioBluepint config
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

		// TODO - can we delete any blueprints
	}
	// TODO - handle showStyleBases & showStyleVariants changes

	// TODO - showStyleBlueprints on change

	// TODO - showStyleBlueprints inactivity timeout?
}
