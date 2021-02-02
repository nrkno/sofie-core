import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { check } from '../../../lib/check'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import {
	ExpectedPlayoutItemGeneric,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	PieceLifespan,
	SomeContent,
} from '@sofie-automation/blueprints-integration'
import * as _ from 'underscore'
import { DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { logger } from '../../logging'
import { PartId, DBPart } from '../../../lib/collections/Parts'
import { saveIntoDb, protectString, unprotectString, literal } from '../../../lib/lib'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { getAllPiecesFromCache, getAllAdLibPiecesFromCache } from '../playout/lib'
import { RundownAPI } from '../../../lib/api/rundown'

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
	rundown: DBRundown,
	items: ExpectedPlayoutItemGenericWithPiece[]
): ExpectedPlayoutItem[] {
	return items.map((item, i) => {
		return {
			_id: protectString(item.pieceId + '_' + i),
			studioId: rundown.studioId,
			rundownId: rundown._id,
			playlistId: rundown.playlistId,
			...item,
		}
	})
}

export function updateExpectedPlayoutItemsOnRundown(cache: CacheForRundownPlaylist, rundownId: RundownId): void {
	check(rundownId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		})
		return
	}

	const intermediaryItems: ExpectedPlayoutItemGenericWithPiece[] = []

	const piecesStartingInThisRundown = cache.Pieces.findFetch({
		startRundownId: rundown._id,
	})
	const piecesGrouped = _.groupBy(piecesStartingInThisRundown, 'startPartId')

	const adlibPiecesInThisRundown = cache.AdLibPieces.findFetch({
		rundownId: rundown._id,
	})
	const adlibPiecesGrouped = _.groupBy(adlibPiecesInThisRundown, 'partId')

	const actionsInThisRundown = cache.AdLibActions.findFetch({
		rundownId: rundown._id,
	})
	const actionsGrouped = _.groupBy(actionsInThisRundown, 'partId')

	for (const part of cache.Parts.findFetch({ rundownId: rundown._id })) {
		intermediaryItems.push(...extractExpectedPlayoutItems(part, piecesGrouped[unprotectString(part._id)] || []))
		intermediaryItems.push(
			...extractExpectedPlayoutItems(part, adlibPiecesGrouped[unprotectString(part._id)] || [])
		)
		intermediaryItems.push(
			...extractExpectedPlayoutItems(
				part,
				actionsGrouped[unprotectString(part._id)]?.map<AdLibPiece>((action) => {
					let sourceLayerId = ''
					let outputLayerId = ''
					let content: Omit<SomeContent, 'timelineObject'> | undefined = undefined
					const isContent = isAdlibActionContent(action.display)
					if (isContent) {
						sourceLayerId = (action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
						outputLayerId = (action.display as IBlueprintActionManifestDisplayContent).outputLayerId
						content = (action.display as IBlueprintActionManifestDisplayContent).content
					}

					return literal<AdLibPiece>({
						_id: protectString(`function_${action._id}`),
						name: action.display.label,
						status: RundownAPI.PieceStatusCode.UNKNOWN,
						expectedDuration: 0,
						externalId: unprotectString(action._id),
						rundownId: action.rundownId,
						sourceLayerId,
						outputLayerId,
						_rank: action.display._rank || 0,
						content: content,
						tags: action.display.tags,
						currentPieceTags: action.display.currentPieceTags,
						nextPieceTags: action.display.nextPieceTags,
						lifespan: PieceLifespan.WithinPart, // value doesn't matter
					})
				}) || []
			)
		)
	}

	cache.deferAfterSave(() => {
		const expectedPlayoutItems = wrapExpectedPlayoutItems(rundown, intermediaryItems)

		saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems,
			{
				rundownId: rundownId,
			},
			expectedPlayoutItems
		)
	})
}

function isAdlibActionContent(
	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
): display is IBlueprintActionManifestDisplayContent {
	if ((display as any).sourceLayerId !== undefined) {
		return true
	}
	return false
}

export function updateExpectedPlayoutItemsOnPart(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	partId: PartId
): void {
	check(rundownId, String)
	check(partId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted rundown "${rundownId}"`)
		})
		return
	}

	const part = cache.Parts.findOne(partId)
	if (!part) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedPlayoutItems.remove({
				rundownId: rundownId,
				partId: partId,
			})
			logger.info(`Removed ${removedItems} expected playout items for deleted part "${partId}"`)
		})
		return
	}

	cache.deferAfterSave(() => {
		const intermediaryItems = extractExpectedPlayoutItems(part, [
			...getAllPiecesFromCache(cache, part),
			...getAllAdLibPiecesFromCache(cache, part),
		])
		const expectedPlayoutItems = wrapExpectedPlayoutItems(rundown, intermediaryItems)

		saveIntoDb<ExpectedPlayoutItem, ExpectedPlayoutItem>(
			ExpectedPlayoutItems,
			{
				rundownId: rundownId,
				partId: part._id,
			},
			expectedPlayoutItems
		)
	})
}
