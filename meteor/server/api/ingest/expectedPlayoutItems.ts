import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { check } from '../../../lib/check'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { ExpectedPlayoutItemGeneric } from 'tv-automation-sofie-blueprints-integration'
import * as _ from 'underscore'
import { DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { logger } from '../../logging'
import { PartId, DBPart } from '../../../lib/collections/Parts'
import { protectString } from '../../../lib/lib'
import { CacheForIngest } from '../../DatabaseCaches'
import { getRundownId } from './lib'
import { DeepReadonly } from 'utility-types'
import { saveIntoCache } from '../../DatabaseCache'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: PartId
	pieceId: PieceId
}
function extractExpectedPlayoutItems(
	part: DBPart,
	pieces: Array<Piece | AdLibPiece>
): ExpectedPlayoutItemGenericWithPiece[] {
	let expectedPlayoutItemsGeneric: ExpectedPlayoutItemGenericWithPiece[] = []

	_.each(pieces, (piece) => {
		if (piece.expectedPlayoutItems) {
			_.each(piece.expectedPlayoutItems, (pieceItem) => {
				expectedPlayoutItemsGeneric.push({
					pieceId: piece._id,
					partId: part._id,
					...pieceItem,
				})
			})
		}
	})

	return expectedPlayoutItemsGeneric
}

function wrapExpectedPlayoutItems(
	rundown: DeepReadonly<DBRundown>,
	items: ExpectedPlayoutItemGenericWithPiece[]
): ExpectedPlayoutItem[] {
	return items.map((item, i) => {
		return {
			_id: protectString(item.pieceId + '_' + i),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			...item,
		}
	})
}

export function updateExpectedPlayoutItemsOnRundown(cache: CacheForIngest): void {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		const removedItems = cache.ExpectedPlayoutItems.remove({})
		const rundownId = getRundownId(cache.Studio.doc, cache.RundownExternalId)
		logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		return
	}

	const intermediaryItems: ExpectedPlayoutItemGenericWithPiece[] = []

	for (const part of cache.Parts.findFetch({ rundownId: rundown._id })) {
		intermediaryItems.push(...extractExpectedPlayoutItems(part, cache.Pieces.findFetch({ startPartId: part._id })))
		intermediaryItems.push(...extractExpectedPlayoutItems(part, cache.AdLibPieces.findFetch({ partId: part._id })))
	}

	const expectedPlayoutItems = wrapExpectedPlayoutItems(rundown, intermediaryItems)

	saveIntoCache<ExpectedPlayoutItem, ExpectedPlayoutItem>(cache.ExpectedPlayoutItems, {}, expectedPlayoutItems)
}
