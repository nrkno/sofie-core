import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { ExpectedPlayoutItem } from '../../../lib/collections/ExpectedPlayoutItems'
import { ExpectedPlayoutItemGeneric } from '@sofie-automation/blueprints-integration'
import * as _ from 'underscore'
import { RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { PartId } from '../../../lib/collections/Parts'
import { protectString, unprotectString } from '../../../lib/lib'
import { CacheForIngest } from './cache'
import { saveIntoCache } from '../../cache/lib'
import { StudioId } from '../../../lib/collections/Studios'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: PartId
	pieceId: PieceId
}
function extractExpectedPlayoutItems(
	partId: PartId,
	pieces: Array<Piece | AdLibPiece>
): ExpectedPlayoutItemGenericWithPiece[] {
	let expectedPlayoutItemsGeneric: ExpectedPlayoutItemGenericWithPiece[] = []

	_.each(pieces, (piece) => {
		if (piece.expectedPlayoutItems) {
			_.each(piece.expectedPlayoutItems, (pieceItem) => {
				expectedPlayoutItemsGeneric.push({
					pieceId: piece._id,
					partId: partId,
					...pieceItem,
				})
			})
		}
	})

	return expectedPlayoutItemsGeneric
}

function wrapExpectedPlayoutItems(
	studioId: StudioId,
	rundownId: RundownId,
	items: ExpectedPlayoutItemGenericWithPiece[]
): ExpectedPlayoutItem[] {
	return items.map((item, i) => {
		return {
			_id: protectString(item.pieceId + '_' + i),
			studioId: studioId,
			rundownId: rundownId,
			...item,
		}
	})
}

/** @deprecated */
export function updateExpectedPlayoutItemsOnRundown(cache: CacheForIngest): void {
	const intermediaryItems: ExpectedPlayoutItemGenericWithPiece[] = []

	const piecesStartingInThisRundown = cache.Pieces.findFetch({})
	const piecesGrouped = _.groupBy(piecesStartingInThisRundown, 'startPartId')

	const adlibPiecesInThisRundown = cache.AdLibPieces.findFetch({})
	const adlibPiecesGrouped = _.groupBy(adlibPiecesInThisRundown, 'partId')

	for (const part of cache.Parts.findFetch({})) {
		intermediaryItems.push(...extractExpectedPlayoutItems(part._id, piecesGrouped[unprotectString(part._id)] || []))
		intermediaryItems.push(
			...extractExpectedPlayoutItems(part._id, adlibPiecesGrouped[unprotectString(part._id)] || [])
		)
	}

	const expectedPlayoutItems = wrapExpectedPlayoutItems(cache.Studio.doc._id, cache.RundownId, intermediaryItems)

	saveIntoCache<ExpectedPlayoutItem, ExpectedPlayoutItem>(cache.ExpectedPlayoutItems, {}, expectedPlayoutItems)
}
