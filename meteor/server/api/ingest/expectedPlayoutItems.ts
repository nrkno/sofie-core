import { check } from 'meteor/check'
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
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { getAllPiecesFromCache, getAllAdLibPiecesFromCache } from '../playout/lib'

interface ExpectedPlayoutItemGenericWithPiece extends ExpectedPlayoutItemGeneric {
	partId?: PartId
	pieceId: PieceId
}
export function extractExpectedPlayoutItems(
	rundown: DBRundown,
	pieces: Array<Piece | AdLibPiece>
): ExpectedPlayoutItem[] {
	let expectedPlayoutItemsGeneric: ExpectedPlayoutItemGenericWithPiece[] = []

	_.each(pieces, (piece) => {
		if (piece.expectedPlayoutItems) {
			_.each(piece.expectedPlayoutItems, (pieceItem) => {
				expectedPlayoutItemsGeneric.push({
					pieceId: piece._id,
					partId: piece.partId,
					...pieceItem,
				})
			})
		}
	})

	let i: number = 0
	return _.map<ExpectedPlayoutItemGenericWithPiece, ExpectedPlayoutItem>(expectedPlayoutItemsGeneric, (item) => {
		return {
			_id: protectString(item.pieceId + '_' + i++),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			...item,
		}
	})
}

export const updateExpectedPlayoutItemsOnRundown: (
	cache: CacheForRundownPlaylist,
	rundownId: RundownId
) => void = syncFunctionIgnore(function updateExpectedPlayoutItemsOnRundown(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId
) {
	check(rundownId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.defer(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		})
		return
	}

	const allPiecesInRundown: Piece[] = []
	_.each(cache.Parts.findFetch({ rundownId: rundown._id }), (part) => {
		_.each(getAllPiecesFromCache(cache, part), (piece) => allPiecesInRundown.push(piece))
	})

	const adlibPieces: AdLibPiece[] = []
	_.each(cache.Parts.findFetch({ rundownId: rundown._id }), (part) => {
		_.each(getAllAdLibPiecesFromCache(cache, part), (adlibPiece) => adlibPieces.push(adlibPiece))
	})

	cache.defer(() => {
		const expectedPlayoutItems: ExpectedPlayoutItem[] = extractExpectedPlayoutItems(rundown, [
			...allPiecesInRundown,
			...adlibPieces,
		])

		saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems,
			{
				rundownId: rundownId,
			},
			expectedPlayoutItems
		)
	})
})

export const updateExpectedPlayoutItemsOnPart: (
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	partId: PartId
) => void = syncFunctionIgnore(function updateExpectedPlayoutItemsOnPart(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	partId: PartId
) {
	check(rundownId, String)
	check(partId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.defer(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		})
		return
	}

	const part = cache.Parts.findOne(partId)
	if (!part) {
		cache.defer(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
				partId: partId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted part "${partId}"`)
		})
		return
	}

	cache.defer(() => {
		const expectedPlayoutItems: ExpectedPlayoutItem[] = extractExpectedPlayoutItems(rundown, [
			...getAllPiecesFromCache(cache, part),
			...part.getAllAdLibPieces(),
		])

		saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems,
			{
				rundownId: rundownId,
				partId: part._id,
			},
			expectedPlayoutItems
		)
	})
})
