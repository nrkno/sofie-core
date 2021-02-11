import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import {
	ExpectedMediaItems,
	ExpectedMediaItem,
	ExpectedMediaItemId,
	ExpectedMediaItemBucketPiece,
	ExpectedMediaItemBucketAction,
	ExpectedMediaItemBase,
	ExpectedMediaItemRundown,
} from '../../../lib/collections/ExpectedMediaItems'
import { RundownId } from '../../../lib/collections/Rundowns'
import { Piece, PieceId } from '../../../lib/collections/Pieces'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import {
	saveIntoDb,
	getCurrentTime,
	getHash,
	protectString,
	asyncCollectionRemove,
	waitForPromise,
	Subtract,
	ProtectedString,
} from '../../../lib/lib'
import { logger } from '../../logging'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { StudioId } from '../../../lib/collections/Studios'
import { CacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { AdLibAction, AdLibActionId } from '../../../lib/collections/AdLibActions'
import {
	IBlueprintActionManifestDisplayContent,
	SomeContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib',
	ACTION = 'action',
}

// TODO-PartInstance generate these for when the part has no need, but the instance still references something

function generateExpectedMediaItems<T extends ExpectedMediaItemBase>(
	sourceId: ProtectedString<any>,
	commonProps: Subtract<T, ExpectedMediaItemBase>,
	studioId: StudioId,
	label: string,
	content: Partial<SomeContent> | undefined,
	pieceType: string
): T[] {
	const result: T[] = []

	const pieceContent = content as Partial<VTContent> | undefined
	if (pieceContent && pieceContent.fileName && pieceContent.path && pieceContent.mediaFlowIds) {
		for (const flow of pieceContent.mediaFlowIds) {
			const id = protectString<ExpectedMediaItemId>(
				getHash(pieceType + '_' + sourceId + '_' + JSON.stringify(commonProps) + '_' + flow)
			)
			const baseObj: ExpectedMediaItemBase = {
				_id: id,
				studioId: studioId,
				label: label,
				disabled: false,
				lastSeen: getCurrentTime(),
				mediaFlowId: flow,
				path: pieceContent.fileName,
				url: pieceContent.path,
			}
			result.push({
				...commonProps,
				...baseObj,
			} as T)
		}
	}

	return result
}

function generateExpectedMediaItemsFull(
	studioId: StudioId,
	rundownId: RundownId,
	pieces: Piece[],
	adlibs: AdLibPiece[],
	actions: AdLibAction[]
): ExpectedMediaItem[] {
	const eMIs: ExpectedMediaItem[] = []

	pieces.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.startPartId,
					rundownId: doc.startRundownId,
				},
				studioId,
				doc.name,
				doc.content,
				PieceType.PIECE
			)
		)
	)
	adlibs.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.partId,
					rundownId: rundownId,
				},
				studioId,
				doc.name,
				doc.content,
				PieceType.ADLIB
			)
		)
	)
	actions.forEach((doc) =>
		eMIs.push(
			...generateExpectedMediaItems<ExpectedMediaItemRundown>(
				doc._id,
				{
					partId: doc.partId,
					rundownId: rundownId,
				},
				studioId,
				doc.display.label,
				(doc.display as IBlueprintActionManifestDisplayContent | undefined)?.content,
				PieceType.ACTION
			)
		)
	)

	return eMIs
}

export async function cleanUpExpectedMediaItemForBucketAdLibPiece(adLibIds: PieceId[]): Promise<void> {
	check(adLibIds, [String])

	const removedItems = await asyncCollectionRemove(ExpectedMediaItems, {
		bucketAdLibPieceId: {
			$in: adLibIds,
		},
	})

	logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib items`)
}

export async function cleanUpExpectedMediaItemForBucketAdLibActions(actionIds: AdLibActionId[]): Promise<void> {
	check(actionIds, [String])

	const removedItems = await asyncCollectionRemove(ExpectedMediaItems, {
		bucketAdLibActionId: {
			$in: actionIds,
		},
	})

	logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib actions`)
}

export function updateExpectedMediaItemForBucketAdLibPiece(adLibId: PieceId): void {
	check(adLibId, String)

	const piece = BucketAdLibs.findOne(adLibId)
	if (!piece) {
		waitForPromise(cleanUpExpectedMediaItemForBucketAdLibPiece([adLibId]))
		throw new Meteor.Error(404, `Bucket AdLib "${adLibId}" not found!`)
	}

	const result = generateExpectedMediaItems<ExpectedMediaItemBucketPiece>(
		piece._id,
		{
			bucketId: piece.bucketId,
			bucketAdLibPieceId: piece._id,
		},
		piece.studioId,
		piece.name,
		piece.content,
		PieceType.ADLIB
	)

	saveIntoDb(
		ExpectedMediaItems,
		{
			bucketAdLibPieceId: adLibId,
		},
		result
	)
}

export function updateExpectedMediaItemForBucketAdLibAction(actionId: AdLibActionId): void {
	check(actionId, String)

	const action = BucketAdLibActions.findOne(actionId)
	if (!action) {
		waitForPromise(cleanUpExpectedMediaItemForBucketAdLibActions([actionId]))
		throw new Meteor.Error(404, `Bucket Action "${actionId}" not found!`)
	}

	const result = generateExpectedMediaItems<ExpectedMediaItemBucketAction>(
		action._id,
		{
			bucketId: action.bucketId,
			bucketAdLibActionId: action._id,
		},
		action.studioId,
		action.display.label,
		(action.display as IBlueprintActionManifestDisplayContent | undefined)?.content,
		PieceType.ADLIB
	)

	saveIntoDb(
		ExpectedMediaItems,
		{
			bucketAdLibActionId: actionId,
		},
		result
	)
}

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

	cache.deferAfterSave(() => {
		const pieces = cache.Pieces.findFetch({
			startRundownId: rundown._id,
		})

		const adlibs = cache.AdLibPieces.findFetch({
			rundownId: rundown._id,
		})

		const actions = cache.AdLibActions.findFetch({
			rundownId: rundown._id,
		})

		const eMIs = generateExpectedMediaItemsFull(studioId, rundownId, pieces, adlibs, actions)

		saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(
			ExpectedMediaItems,
			{
				rundownId: rundown._id,
			},
			eMIs
		)
	})
}
