import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem, ExpectedMediaItemId } from '../../lib/collections/ExpectedMediaItems'
import { RundownId } from '../../lib/collections/Rundowns'
import { PieceGeneric, PieceId } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, getCurrentTime, getHash, protectString, check } from '../../lib/lib'
import { PartId } from '../../lib/collections/Parts'
import { Random } from 'meteor/random'
import { logger } from '../logging'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { StudioId } from '../../lib/collections/Studios'
import { BucketId } from '../../lib/collections/Buckets'
import { CacheForRundownPlaylist } from '../DatabaseCaches'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib'
}

// TODO-PartInstance generate these for when the part has no need, but the instance still references something

function generateExpectedMediaItems(rundownId: RundownId, studioId: StudioId, piece: PieceGeneric, pieceType: string): ExpectedMediaItem[] {
	const result: ExpectedMediaItem[] = []

	if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds && piece.partId) {
		const partId = piece.partId;
		(piece.content.mediaFlowIds as string[]).forEach(function (flow) {
			const id = protectString<ExpectedMediaItemId>(getHash(pieceType + '_' + piece._id + '_' + flow + '_' + rundownId + '_' + piece.partId))
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
				studioId: studioId
			})
		}, [piece.content.fileName, piece.content.path])
	}

	return result
}

export const cleanUpExpectedMediaItemForBucketAdLibPiece: (adLibIds: PieceId[]) => void
	= syncFunctionIgnore(function cleanUpExpectedMediaItemForBucketAdLibPiece(adLibIds: PieceId[]) {
		check(adLibIds, [String])

		const removedItems = ExpectedMediaItems.remove({
			bucketAdLibPieceId: {
				$in: adLibIds
			}
		})

		logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib items`)
	})

export const updateExpectedMediaItemForBucketAdLibPiece: (adLibId: PieceId, bucketId: BucketId) => void
	= syncFunctionIgnore(function updateExpectedMediaItemForBucketAdLibPiece(adLibId: PieceId, bucketId: BucketId) {
		check(adLibId, String)

		const piece = BucketAdLibs.findOne(adLibId)
		if (!piece) {
			throw new Meteor.Error(404, `Bucket AdLib "${adLibId}" not found!`)
		}

		if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds) {
			(piece.content.mediaFlowIds as string[]).forEach(function (flow) {
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
					bucketAdLibPieceId: piece._id
				})
			}, [piece.content.fileName, piece.content.path])
		}
	})

export const updateExpectedMediaItemsOnRundown: (cache: CacheForRundownPlaylist, rundownId: RundownId) => void
	= syncFunctionIgnore(function updateExpectedMediaItemsOnRundown(cache: CacheForRundownPlaylist, rundownId: RundownId) {
		check(rundownId, String)

		const rundown = cache.Rundowns.findOne(rundownId)
		if (!rundown) {
			cache.defer(() => {
				const removedItems = ExpectedMediaItems.remove({
					rundownId: rundownId
				})
				logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
			})
			return
		}
		const studioId = rundown.studioId

		const pieces = cache.Pieces.findFetch({
			rundownId: rundown._id
		})

		cache.defer(() => {
			const adlibs = AdLibPieces.find({
				rundownId: rundown._id
			}).fetch()

			const eMIs: ExpectedMediaItem[] = []

			function iterateOnPieceLike(piece: PieceGeneric, pieceType: string) {
				eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
			}

			pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
			adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

			saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
				rundownId: rundown._id
			}, eMIs)
		})
	})

export const updateExpectedMediaItemsOnPart: (cache: CacheForRundownPlaylist, rundownId: RundownId, partId: PartId) => void
	= syncFunctionIgnore(function updateExpectedMediaItemsOnPart(cache: CacheForRundownPlaylist, rundownId: RundownId, partId: PartId) {
		check(rundownId, String)
		check(partId, String)

		const rundown = cache.Rundowns.findOne(rundownId)
		if (!rundown) {
			cache.defer(() => {
				const removedItems = ExpectedMediaItems.remove({
					rundownId: rundownId
				})
				logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
			})
			return
		}
		const studioId = rundown.studioId

		const part = cache.Parts.findOne(partId)
		if (!part) {
			cache.defer(() => {
				const removedItems = ExpectedMediaItems.remove({
					rundownId: rundownId,
					partId: partId
				})
				logger.info(`Removed ${removedItems} expected media items for deleted part "${partId}"`)
			})
			return
		}

		const pieces = cache.Pieces.findFetch({
			rundownId: rundown._id,
			partId: part._id
		})

		cache.defer(() => {
			const eMIs: ExpectedMediaItem[] = []

			const adlibs = AdLibPieces.find({
				rundownId: rundown._id,
				partId: part._id
			}).fetch()

			function iterateOnPieceLike(piece: PieceGeneric, pieceType: string) {
				eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
			}

			pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
			adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

			saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
				rundownId: rundown._id,
				partId: part._id
			}, eMIs)
		})
	})
