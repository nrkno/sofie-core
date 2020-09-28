import { check } from '../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem, ExpectedMediaItemId } from '../../lib/collections/ExpectedMediaItems'
import { RundownId } from '../../lib/collections/Rundowns'
import { PieceGeneric, PieceId } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, getCurrentTime, getHash, protectString } from '../../lib/lib'
import { PartId } from '../../lib/collections/Parts'
import { logger } from '../logging'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { StudioId } from '../../lib/collections/Studios'
import { BucketId } from '../../lib/collections/Buckets'
import { CacheForIngest } from '../DatabaseCaches'
import { getRundownId } from './ingest/lib'
import { saveIntoCache } from '../DatabaseCache'

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

export function updateExpectedMediaItemsOnRundown(cache: CacheForIngest): void {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		const removedItems = cache.ExpectedMediaItems.remove({})
		const rundownId = getRundownId(cache.Studio.doc, cache.RundownExternalId)
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioId = rundown.studioId
	const rundownId = rundown._id

	const eMIs: ExpectedMediaItem[] = []

	function iterateOnPieceLike(piece: PieceGeneric, partId: PartId | undefined, pieceType: string) {
		eMIs.push(...generateExpectedMediaItems(rundownId, studioId, partId, piece, pieceType))
	}

	cache.Pieces.findFetch({}).forEach((doc) => iterateOnPieceLike(doc, doc.startPartId, PieceType.PIECE))
	cache.AdLibPieces.findFetch({}).forEach((doc) => iterateOnPieceLike(doc, doc.partId, PieceType.ADLIB))

	saveIntoCache<ExpectedMediaItem, ExpectedMediaItem>(cache.ExpectedMediaItems, {}, eMIs)
}
