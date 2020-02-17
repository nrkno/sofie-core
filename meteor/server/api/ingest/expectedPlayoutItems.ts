import { check } from 'meteor/check'
import { PieceGeneric, Piece } from '../../../lib/collections/Pieces'
import { ExpectedPlayoutItem, ExpectedPlayoutItemGeneric, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import * as _ from 'underscore'
import { DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../../codeControl'
import { logger } from '../../logging'
import { Parts } from '../../../lib/collections/Parts'
import { saveIntoDb } from '../../../lib/lib'

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

export const updateExpectedPlayoutItemsOnRundown: (rundownId: string) => void
= syncFunctionIgnore(function updateExpectedPlayoutItemsOnRundown (rundownId: string) {
	check(rundownId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedPlayoutItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		return
	}

	const allPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []
	_.each(rundown.getParts(), part => {
		_.each(part.getAllPieces(), piece => allPieces.push(piece))
		_.each(part.getAllAdLibPieces(), adlibPiece => adlibPieces.push(adlibPiece))
	})

	const expectedPlayoutItems: ExpectedPlayoutItem[] = extractExpectedPlayoutItems(rundown, [
		...allPieces,
		...adlibPieces
	])

	saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(ExpectedPlayoutItems, {
		rundownId: rundownId,
	}, expectedPlayoutItems)
})

export const updateExpectedPlayoutItemsOnPart: (rundownId: string, partId: string) => void
= syncFunctionIgnore(function updateExpectedPlayoutItemsOnPart (rundownId: string, partId: string) {
	check(rundownId, String)
	check(partId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedPlayoutItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		return
	}

	const part = Parts.findOne(partId)
	if (!part) {
		const removedItems = ExpectedPlayoutItems.remove({
			rundownId: rundownId,
			partId: partId
		})
		logger.info(`Removed ${removedItems} expected playout items for deleted part "${partId}"`)
		return
	}

	const expectedPlayoutItems: ExpectedPlayoutItem[] = extractExpectedPlayoutItems(rundown, [
		...part.getAllPieces(),
		...part.getAllAdLibPieces()
	])

	saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(ExpectedPlayoutItems, {
		rundownId: rundownId,
		partId: part._id
	}, expectedPlayoutItems)
})
