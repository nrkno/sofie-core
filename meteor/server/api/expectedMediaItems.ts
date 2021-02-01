import { check } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem, ExpectedMediaItemId } from '../../lib/collections/ExpectedMediaItems'
import { RundownId } from '../../lib/collections/Rundowns'
import { PieceGeneric, PieceId } from '../../lib/collections/Pieces'
import { AdLibPiece, AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, getCurrentTime, getHash, protectString, literal, unprotectString } from '../../lib/lib'
import { PartId } from '../../lib/collections/Parts'
import { logger } from '../logging'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { StudioId } from '../../lib/collections/Studios'
import { BucketId } from '../../lib/collections/Buckets'
import { CacheForRundownPlaylist } from '../DatabaseCaches'
import { AdLibAction, AdLibActions } from '../../lib/collections/AdLibActions'
import {
	SomeContent,
	IBlueprintActionManifestDisplayContent,
	PieceLifespan,
	IBlueprintActionManifestDisplay,
} from 'tv-automation-sofie-blueprints-integration'
import { RundownAPI } from '../../lib/api/rundown'
import { RundownBaselineAdLibAction } from '../../lib/collections/RundownBaselineAdLibActions'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib',
}

// TODO-PartInstance generate these for when the part has no need, but the instance still references something

function generateExpectedMediaItems(
	rundownId: RundownId,
	studioId: StudioId,
	partId: PartId | undefined,
	piece: PieceGeneric,
	pieceType: string
): ExpectedMediaItem[] {
	const result: ExpectedMediaItem[] = []

	if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds) {
		;(piece.content.mediaFlowIds as string[]).forEach(
			function(flow) {
				const id = protectString<ExpectedMediaItemId>(
					getHash(pieceType + '_' + piece._id + '_' + flow + '_' + rundownId + '_' + partId)
				)
				result.push({
					_id: id,
					label: piece.name,
					disabled: false,
					lastSeen: getCurrentTime(),
					mediaFlowId: flow,
					path: this[0].toString(),
					url: this[1].toString(),

					rundownId: rundownId,
					partId: partId,
					studioId: studioId,
				})
			},
			[piece.content.fileName, piece.content.path]
		)
	}

	return result
}

export const cleanUpExpectedMediaItemForBucketAdLibPiece: (adLibIds: PieceId[]) => void = syncFunctionIgnore(
	function cleanUpExpectedMediaItemForBucketAdLibPiece(adLibIds: PieceId[]) {
		check(adLibIds, [String])

		const removedItems = ExpectedMediaItems.remove({
			bucketAdLibPieceId: {
				$in: adLibIds,
			},
		})

		logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib items`)
	},
	'cleanUpExpectedMediaItemForBucketAdLibPiece'
)

export const updateExpectedMediaItemForBucketAdLibPiece: (
	adLibId: PieceId,
	bucketId: BucketId
) => void = syncFunctionIgnore(function updateExpectedMediaItemForBucketAdLibPiece(
	adLibId: PieceId,
	bucketId: BucketId
) {
	check(adLibId, String)

	const piece = BucketAdLibs.findOne(adLibId)
	if (!piece) {
		throw new Meteor.Error(404, `Bucket AdLib "${adLibId}" not found!`)
	}

	if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds) {
		;(piece.content.mediaFlowIds as string[]).forEach(
			function(flow) {
				const id = getHash(PieceType.ADLIB + '_' + piece._id + '_' + flow + '_' + piece.bucketId)
				ExpectedMediaItems.insert({
					_id: protectString(id),
					label: piece.name,
					disabled: false,
					lastSeen: getCurrentTime(),
					mediaFlowId: flow,
					path: this[0].toString(),
					url: this[1].toString(),
					studioId: piece.studioId,

					bucketId: piece.bucketId,
					bucketAdLibPieceId: piece._id,
				})
			},
			[piece.content.fileName, piece.content.path]
		)
	}
},
'updateExpectedMediaItemForBucketAdLibPiecey')

export function updateExpectedMediaItemsOnRundown(cache: CacheForRundownPlaylist, rundownId: RundownId): void {
	check(rundownId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedMediaItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		})
		return
	}
	const studioId = rundown.studioId

	const pieces = cache.Pieces.findFetch({
		startRundownId: rundown._id,
	})

	cache.deferAfterSave(() => {
		const adlibs = AdLibPieces.find({
			rundownId: rundown._id,
		}).fetch()

		const actions = AdLibActions.find({
			rundownId: rundown._id,
		}).fetch()

		const eMIs: ExpectedMediaItem[] = []

		function iterateOnPieceLike(piece: PieceGeneric, partId: PartId | undefined, pieceType: string) {
			eMIs.push(...generateExpectedMediaItems(rundownId, studioId, partId, piece, pieceType))
		}

		pieces.forEach((doc) => iterateOnPieceLike(doc, doc.startPartId, PieceType.PIECE))
		adlibs.forEach((doc) => iterateOnPieceLike(doc, doc.partId, PieceType.ADLIB))
		actions.forEach((doc) => iterateOnPieceLike(actionToAdLibPieceUi(doc), doc.partId, PieceType.ADLIB))

		saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(
			ExpectedMediaItems,
			{
				rundownId: rundown._id,
			},
			eMIs
		)
	})
}

// TEMP: Tests fail if the function is imported from the UI
export interface AdLibPieceUi extends AdLibPiece {
	hotkey?: string
	isGlobal?: boolean
	isHidden?: boolean
	isSticky?: boolean
	isAction?: boolean
	isClearSourceLayer?: boolean
	adlibAction?: AdLibAction | RundownBaselineAdLibAction
}

export function isAdlibActionContent(
	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
): display is IBlueprintActionManifestDisplayContent {
	if ((display as any).sourceLayerId !== undefined) {
		return true
	}
	return false
}

export function actionToAdLibPieceUi(action: AdLibAction | RundownBaselineAdLibAction): AdLibPieceUi {
	let sourceLayerId = ''
	let outputLayerId = ''
	let content: Omit<SomeContent, 'timelineObject'> | undefined = undefined
	const isContent = isAdlibActionContent(action.display)
	if (isContent) {
		sourceLayerId = (action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
		outputLayerId = (action.display as IBlueprintActionManifestDisplayContent).outputLayerId
		content = (action.display as IBlueprintActionManifestDisplayContent).content
	}

	return literal<AdLibPieceUi>({
		_id: protectString(`function_${action._id}`),
		name: action.display.label,
		status: RundownAPI.PieceStatusCode.UNKNOWN,
		isAction: true,
		expectedDuration: 0,
		externalId: unprotectString(action._id),
		rundownId: action.rundownId,
		sourceLayerId,
		outputLayerId,
		_rank: action.display._rank || 0,
		content: content,
		adlibAction: action,
		tags: action.display.tags,
		currentPieceTags: action.display.currentPieceTags,
		nextPieceTags: action.display.nextPieceTags,
		lifespan: PieceLifespan.WithinPart, // value doesn't matter
	})
}

// End TEMP

export function updateExpectedMediaItemsOnPart(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	partId: PartId
): void {
	check(rundownId, String)
	check(partId, String)

	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedMediaItems.remove({
				rundownId: rundownId,
			})
			logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		})
		return
	}
	const studioId = rundown.studioId

	const part = cache.Parts.findOne(partId)
	if (!part) {
		cache.deferAfterSave(() => {
			const removedItems = ExpectedMediaItems.remove({
				rundownId: rundownId,
				partId: partId,
			})
			logger.info(`Removed ${removedItems} expected media items for deleted part "${partId}"`)
		})
		return
	}

	const pieces = cache.Pieces.findFetch({
		startRundownId: rundown._id,
		startPartId: partId,
	})

	cache.deferAfterSave(() => {
		const eMIs: ExpectedMediaItem[] = []

		const adlibs = AdLibPieces.find({
			rundownId: rundown._id,
			partId: partId,
		}).fetch()

		function iterateOnPieceLike(piece: PieceGeneric, pieceType: string) {
			eMIs.push(...generateExpectedMediaItems(rundownId, studioId, partId, piece, pieceType))
		}

		pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
		adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

		saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(
			ExpectedMediaItems,
			{
				rundownId: rundown._id,
				partId: partId,
			},
			eMIs
		)
	})
}
