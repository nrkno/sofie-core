import { PieceGeneric, Piece } from '../../../lib/collections/Pieces'
import { ExpectedPlayoutItem, ExpectedPlayoutItemGeneric } from '../../../lib/collections/ExpectedPlayoutItems'
import * as _ from 'underscore'
import { DBRundown } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: string
	pieceId: string
}
export function extractExpectedPlayoutItems (rundown: DBRundown, pieces: Array<Piece | AdLibPiece>): ExpectedPlayoutItem[] {

	let expectedPlayoutItemsGeneric: ExpectedPlayoutItemGenericWithPiece[] = []

	_.each(pieces, piece => {

		if (piece.expectedPlayoutItems) {

			_.each(piece.expectedPlayoutItems, pieceItem => {

				expectedPlayoutItemsGeneric.push({
					pieceId: piece._id,
					partId: piece.partId,
					...pieceItem
				})
			})
		}
	})
	// TODO: Maybe make the expectedPlayoutItemsGeneric unique first?

	// expectedPlayoutItemsGeneric.sort((a, b) => {
	// })
	// expectedPlayoutItemsGeneric = _.uniq(expectedPlayoutItemsGeneric, false, (a ,b) => {
	// 	return _.isEqual(
	// 		_.omit(a, ['pieceId']),
	// 		_.omit(b, ['pieceId'])
	// 	)
	// })

	let i: number = 0
	return _.map<ExpectedPlayoutItemGenericWithPiece, ExpectedPlayoutItem>(expectedPlayoutItemsGeneric, item => {
		return {
			_id: item.pieceId + '_' + (i++),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			...item
		}
	})
}
