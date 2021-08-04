import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { loadStudioBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { IDirectCollections } from '../db'
import { BlueprintId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface WorkerDataCache {
	studio: DBStudio
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
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
}
