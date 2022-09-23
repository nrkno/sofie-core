import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	ExpectedPlayoutItem,
	ExpectedPlayoutItemRundown,
	ExpectedPlayoutItemStudio,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { StudioId, RundownId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { saveIntoCache } from '../cache/lib'
import { saveIntoDb } from '../db/changes'
import { CacheForPlayout } from '../playout/cache'
import { CacheForStudio } from '../studio/cache'
import _ = require('underscore')
import { ExpectedPlayoutItemGeneric } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { CacheForIngest } from './cache'

function extractExpectedPlayoutItems(
	studioId: StudioId,
	rundownId: RundownId,
	partId: PartId | undefined,
	piece: Piece | AdLibPiece | AdLibAction | RundownBaselineAdLibAction
): ExpectedPlayoutItem[] {
	const expectedPlayoutItemsGeneric: ExpectedPlayoutItem[] = []

	if (piece.expectedPlayoutItems) {
		_.each(piece.expectedPlayoutItems, (pieceItem, i) => {
			expectedPlayoutItemsGeneric.push({
				...pieceItem,
				_id: protectString(piece._id + '_' + i),
				studioId: studioId,
				rundownId: rundownId,
				// pieceId: piece._id,
				partId: partId,
			})
		})
	}

	return expectedPlayoutItemsGeneric
}

/** @deprecated */
export async function updateExpectedPlayoutItemsOnRundown(context: JobContext, cache: CacheForIngest): Promise<void> {
	const expectedPlayoutItems: ExpectedPlayoutItem[] = []

	const studioId = context.studio._id
	const rundownId = cache.RundownId

	// It isn't great to have to load these unnecessarily, but expectedPackages will resolve this
	const [baselineAdlibPieces, baselineAdlibActions] = await Promise.all([
		cache.RundownBaselineAdLibPieces.get(),
		cache.RundownBaselineAdLibActions.get(),
	])

	for (const piece of cache.Pieces.findAll(null)) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, piece.startPartId, piece))
	}
	for (const piece of cache.AdLibPieces.findAll(null)) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, piece.partId, piece))
	}
	for (const piece of baselineAdlibPieces.findAll(null)) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, piece))
	}
	for (const action of cache.AdLibActions.findAll(null)) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, action.partId, action))
	}
	for (const action of baselineAdlibActions.findAll(null)) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, action))
	}

	saveIntoCache<ExpectedPlayoutItem>(context, cache.ExpectedPlayoutItems, (p) => !p.baseline, expectedPlayoutItems)
}

export function updateBaselineExpectedPlayoutItemsOnRundown(
	context: JobContext,
	cache: CacheForIngest,
	items?: ExpectedPlayoutItemGeneric[]
): void {
	saveIntoCache<ExpectedPlayoutItem>(
		context,
		cache.ExpectedPlayoutItems,
		(p) => p.baseline === 'rundown',
		(items || []).map((item): ExpectedPlayoutItemRundown => {
			return {
				...item,
				_id: getRandomId(),
				studioId: context.studio._id,
				rundownId: cache.RundownId,
				baseline: 'rundown',
			}
		})
	)
}
export function updateBaselineExpectedPlayoutItemsOnStudio(
	context: JobContext,
	cache: CacheForStudio | CacheForPlayout,
	items?: ExpectedPlayoutItemGeneric[]
): void {
	cache.deferAfterSave(async () => {
		await saveIntoDb(
			context,
			context.directCollections.ExpectedPlayoutItems,
			{ studioId: context.studio._id, baseline: 'studio' },
			(items || []).map((item): ExpectedPlayoutItemStudio => {
				return {
					...item,
					_id: getRandomId(),
					studioId: context.studio._id,
					baseline: 'studio',
				}
			})
		)
	})
}
