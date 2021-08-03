import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import {
	ExpectedMediaItems,
	ExpectedMediaItemId,
	ExpectedMediaItemBucketPiece,
	ExpectedMediaItemBucketAction,
	ExpectedMediaItemBase,
} from '../../../lib/collections/ExpectedMediaItems'
import { PieceId } from '../../../lib/collections/Pieces'
import { getCurrentTime, getHash, protectString, Subtract, ProtectedString } from '../../../lib/lib'
import { logger } from '../../logging'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { StudioId } from '../../../lib/collections/Studios'
import { AdLibActionId } from '../../../lib/collections/AdLibActions'
import {
	IBlueprintActionManifestDisplayContent,
	SomeContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'
import { saveIntoDb } from '../../lib/database'
import { interpollateTranslation, translateMessage } from '../../../lib/api/TranslatableMessage'

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

export async function cleanUpExpectedMediaItemForBucketAdLibPiece(adLibIds: PieceId[]): Promise<void> {
	check(adLibIds, [String])

	const removedItems = await ExpectedMediaItems.removeAsync({
		bucketAdLibPieceId: {
			$in: adLibIds,
		},
	})

	logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib items`)
}

export async function cleanUpExpectedMediaItemForBucketAdLibActions(actionIds: AdLibActionId[]): Promise<void> {
	check(actionIds, [String])

	const removedItems = await ExpectedMediaItems.removeAsync({
		bucketAdLibActionId: {
			$in: actionIds,
		},
	})

	logger.info(`Removed ${removedItems} expected media items for deleted bucket adLib actions`)
}

export async function updateExpectedMediaItemForBucketAdLibPiece(adLibId: PieceId): Promise<void> {
	check(adLibId, String)

	const piece = await BucketAdLibs.findOneAsync(adLibId)
	if (!piece) {
		await cleanUpExpectedMediaItemForBucketAdLibPiece([adLibId])
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

	await saveIntoDb(
		ExpectedMediaItems,
		{
			bucketAdLibPieceId: adLibId,
		},
		result
	)
}

export async function updateExpectedMediaItemForBucketAdLibAction(actionId: AdLibActionId): Promise<void> {
	check(actionId, String)

	const action = await BucketAdLibActions.findOneAsync(actionId)
	if (!action) {
		await cleanUpExpectedMediaItemForBucketAdLibActions([actionId])
		throw new Meteor.Error(404, `Bucket Action "${actionId}" not found!`)
	}

	const result = generateExpectedMediaItems<ExpectedMediaItemBucketAction>(
		action._id,
		{
			bucketId: action.bucketId,
			bucketAdLibActionId: action._id,
		},
		action.studioId,
		translateMessage(action.display.label, interpollateTranslation),
		(action.display as IBlueprintActionManifestDisplayContent | undefined)?.content,
		PieceType.ADLIB
	)

	await saveIntoDb(
		ExpectedMediaItems,
		{
			bucketAdLibActionId: actionId,
		},
		result
	)
}
