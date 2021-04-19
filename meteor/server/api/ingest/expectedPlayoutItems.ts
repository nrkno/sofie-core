import { Piece } from '../../../lib/collections/Pieces'
import { ExpectedPlayoutItem } from '../../../lib/collections/ExpectedPlayoutItems'
import * as _ from 'underscore'
import { RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { PartId } from '../../../lib/collections/Parts'
import { protectString } from '../../../lib/lib'
import { CacheForIngest } from './cache'
import { saveIntoCache } from '../../cache/lib'
import { StudioId } from '../../../lib/collections/Studios'

function extractExpectedPlayoutItems(
	studioId: StudioId,
	rundownId: RundownId,
	partId: PartId | undefined,
	piece: Piece | AdLibPiece
): ExpectedPlayoutItem[] {
	let expectedPlayoutItemsGeneric: ExpectedPlayoutItem[] = []

	if (piece.expectedPlayoutItems) {
		_.each(piece.expectedPlayoutItems, (pieceItem, i) => {
			expectedPlayoutItemsGeneric.push({
				...pieceItem,
				_id: protectString(piece._id + '_' + i),
				studioId: studioId,
				rundownId: rundownId,
				pieceId: piece._id,
				partId: partId,
			})
		})
	}

	return expectedPlayoutItemsGeneric
}

/** @deprecated */
export function updateExpectedPlayoutItemsOnRundown(cache: CacheForIngest): void {
	const expectedPlayoutItems: ExpectedPlayoutItem[] = []

	const studioId = cache.Studio.doc._id
	const rundownId = cache.RundownId

	for (const piece of cache.Pieces.findFetch({})) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, piece.startPartId, piece))
	}
	for (const piece of cache.AdLibPieces.findFetch({})) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, piece.partId, piece))
	}
	for (const piece of cache.RundownBaselineAdLibPieces.findFetch({})) {
		expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, piece))
	}
	// for (const piece of cache.AdLibActions.findFetch({})) {
	// 	expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, piece.partId, piece))
	// }
	// for (const piece of cache.RundownBaselineAdLibActions.findFetch({})) {
	// 	expectedPlayoutItems.push(...extractExpectedPlayoutItems(studioId, rundownId, undefined, piece))
	// }

	saveIntoCache<ExpectedPlayoutItem, ExpectedPlayoutItem>(cache.ExpectedPlayoutItems, {}, expectedPlayoutItems)
}
