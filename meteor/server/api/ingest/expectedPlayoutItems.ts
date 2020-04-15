import { check } from '../../../lib/check'
import { PieceGeneric, Piece, PieceId } from '../../../lib/collections/Pieces'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { ExpectedPlayoutItemGeneric } from 'tv-automation-sofie-blueprints-integration'
import * as _ from 'underscore'
import { DBRundown, Rundowns, RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../../codeControl'
import { logger } from '../../logging'
import { Parts, PartId } from '../../../lib/collections/Parts'
import { saveIntoDb, protectString } from '../../../lib/lib'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: PartId
	pieceId: PieceId
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

	let i: number = 0
	return _.map<ExpectedPlayoutItemGenericWithPiece, ExpectedPlayoutItem>(expectedPlayoutItemsGeneric, item => {
		return {
			_id: protectString(item.pieceId + '_' + (i++)),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			...item
		}
	})
}

export const updateExpectedPlayoutItemsOnRundown: (rundownId: RundownId) => void
= syncFunctionIgnore(function updateExpectedPlayoutItemsOnRundown (rundownId: RundownId) {
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

export const updateExpectedPlayoutItemsOnPart: (rundownId: RundownId, partId: PartId) => void
= syncFunctionIgnore(function updateExpectedPlayoutItemsOnPart (rundownId: RundownId, partId: PartId) {
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
