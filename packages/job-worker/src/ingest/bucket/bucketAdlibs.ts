import { PieceId, AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs'
import {
	BucketActionModifyProps,
	BucketActionRegenerateExpectedPackagesProps,
	BucketEmptyProps,
	BucketPieceModifyProps,
	BucketRemoveAdlibActionProps,
	BucketRemoveAdlibPieceProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import {
	cleanUpExpectedPackagesForBucketAdLibs,
	cleanUpExpectedPackagesForBucketAdLibsActions,
	updateExpectedPackagesForBucketAdLibPiece,
	updateExpectedPackagesForBucketAdLibAction,
} from '../expectedPackages'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from '../expectedMediaItems'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { MongoQuery } from '../../db'

export async function handleBucketRemoveAdlibPiece(
	context: JobContext,
	data: BucketRemoveAdlibPieceProps
): Promise<void> {
	const piece = await context.directCollections.BucketAdLibPieces.findOne(data.pieceId)
	if (!piece || piece.studioId !== context.studioId)
		throw new Error(`Bucket Piece "${data.pieceId}" not found in this studio`)

	const idsToUpdate: PieceId[] = [piece._id]
	// Also remove adlibs that are grouped together with this adlib in the GUI:
	;(await getGroupedAdlibs(context, piece)).forEach(({ _id }) => idsToUpdate.push(_id))

	await Promise.all([
		context.directCollections.BucketAdLibPieces.remove({ _id: { $in: idsToUpdate } }),
		cleanUpExpectedMediaItemForBucketAdLibPiece(context, idsToUpdate),
		cleanUpExpectedPackagesForBucketAdLibs(context, idsToUpdate),
	])
}

export async function handleBucketRemoveAdlibAction(
	context: JobContext,
	data: BucketRemoveAdlibActionProps
): Promise<void> {
	const action = await context.directCollections.BucketAdLibActions.findOne(data.actionId)
	if (!action || action.studioId !== context.studioId)
		throw new Error(`Bucket Action "${data.actionId}" not found in this studio`)

	const idsToUpdate: AdLibActionId[] = [action._id]
	// Also remove adlibs that are grouped together with this adlib in the GUI:
	;(await getGroupedAdlibActions(context, action)).forEach(({ _id }) => idsToUpdate.push(_id))

	await Promise.all([
		context.directCollections.BucketAdLibActions.remove({ _id: { $in: idsToUpdate } }),
		cleanUpExpectedMediaItemForBucketAdLibActions(context, idsToUpdate),
		cleanUpExpectedPackagesForBucketAdLibsActions(context, idsToUpdate),
	])
}

export async function handleBucketEmpty(context: JobContext, data: BucketEmptyProps): Promise<void> {
	const id = data.bucketId

	await Promise.all([
		context.directCollections.BucketAdLibPieces.remove({ bucketId: id, studioId: context.studioId }),
		context.directCollections.BucketAdLibActions.remove({ bucketId: id, studioId: context.studioId }),
		context.directCollections.ExpectedMediaItems.remove({ bucketId: id, studioId: context.studioId }),
		context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
			bucketId: id,
		}),
		context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
			bucketId: id,
		}),
	])
}

export async function handleBucketActionRegenerateExpectedPackages(
	context: JobContext,
	data: BucketActionRegenerateExpectedPackagesProps
): Promise<void> {
	const action = await context.directCollections.BucketAdLibActions.findOne(data.actionId)
	if (!action || action.studioId !== context.studioId)
		throw new Error(`Bucket Action "${data.actionId}" not found in this studio`)

	await Promise.all([
		updateExpectedMediaItemForBucketAdLibAction(context, action),
		updateExpectedPackagesForBucketAdLibAction(context, action),
	])
}

export async function handleBucketActionModify(context: JobContext, data: BucketActionModifyProps): Promise<void> {
	const orgAction = await context.directCollections.BucketAdLibActions.findOne(data.actionId)
	if (!orgAction || orgAction.studioId !== context.studioId)
		throw new Error(`Bucket Action "${data.actionId}" not found in this studio`)

	// Also update adlibs that are grouped together with this adlib in the GUI:
	const actionsToUpdate = await getGroupedAdlibActions(context, orgAction)

	for (const action of actionsToUpdate) {
		const newAction = {
			...action,
		}

		switch (data.props.type) {
			case 'move':
				await context.directCollections.BucketAdLibActions.update(action._id, {
					$set: {
						bucketId: data.props.newBucketId,
					},
				})
				newAction.bucketId = data.props.newBucketId
				break
			case 'rename':
				await context.directCollections.BucketAdLibActions.update(action._id, {
					$set: {
						'display.label': data.props.newName,
					},
				})
				newAction.display.label = data.props.newName as any
				break
			case 'rerank':
				await context.directCollections.BucketAdLibActions.update(action._id, {
					$set: {
						'display._rank': data.props.newRank,
					},
				})
				newAction.display._rank = data.props.newRank
				break
			default:
				assertNever(data.props)
		}

		await Promise.all([
			updateExpectedMediaItemForBucketAdLibAction(context, newAction),
			updateExpectedPackagesForBucketAdLibAction(context, newAction),
		])
	}
}

export async function handleBucketPieceModify(context: JobContext, data: BucketPieceModifyProps): Promise<void> {
	const orgPiece = await context.directCollections.BucketAdLibPieces.findOne(data.pieceId)
	if (!orgPiece || orgPiece.studioId !== context.studioId)
		throw new Error(`Bucket Piece "${data.pieceId}" not found in this studio`)

	// Also update adlibs that are grouped together with this adlib in the GUI:
	const piecesToUpdate = await getGroupedAdlibs(context, orgPiece)

	for (const piece of piecesToUpdate) {
		const newPiece = {
			...piece,
		}

		switch (data.props.type) {
			case 'move':
				await context.directCollections.BucketAdLibPieces.update(piece._id, {
					$set: {
						bucketId: data.props.newBucketId,
					},
				})
				newPiece.bucketId = data.props.newBucketId
				break
			case 'rename':
				await context.directCollections.BucketAdLibPieces.update(piece._id, {
					$set: {
						name: data.props.newName,
					},
				})
				newPiece.name = data.props.newName
				break
			case 'rerank':
				await context.directCollections.BucketAdLibPieces.update(piece._id, {
					$set: {
						_rank: data.props.newRank,
					},
				})
				newPiece._rank = data.props.newRank
				break
			default:
				assertNever(data.props)
		}

		await Promise.all([
			updateExpectedMediaItemForBucketAdLibPiece(context, newPiece),
			updateExpectedPackagesForBucketAdLibPiece(context, newPiece),
		])
	}
}
/** Returns BucketAdlibActions that are grouped together with this adlib in the GUI */
async function getGroupedAdlibActions(context: JobContext, oldAdLib: BucketAdLibAction): Promise<BucketAdLibAction[]> {
	let selector: MongoQuery<BucketAdLibAction>
	if (oldAdLib.uniquenessId) {
		selector = {
			bucketId: oldAdLib.bucketId,
			studioId: oldAdLib.studioId,
			$or: [
				{
					externalId: oldAdLib.externalId,
				},
				{
					uniquenessId: oldAdLib.uniquenessId,
				},
			],
		}
	} else if (oldAdLib.externalId) {
		selector = {
			bucketId: oldAdLib.bucketId,
			studioId: oldAdLib.studioId,
			externalId: oldAdLib.externalId,
		}
	} else {
		return []
	}

	return context.directCollections.BucketAdLibActions.findFetch(selector)
}

/** Returns BucketAdlibs that are grouped together with this adlib in the GUI */
async function getGroupedAdlibs(context: JobContext, oldAdLib: BucketAdLib): Promise<BucketAdLib[]> {
	let selector: MongoQuery<BucketAdLib>
	if (oldAdLib.uniquenessId) {
		selector = {
			bucketId: oldAdLib.bucketId,
			studioId: oldAdLib.studioId,
			$or: [
				{
					externalId: oldAdLib.externalId,
				},
				{
					uniquenessId: oldAdLib.uniquenessId,
				},
			],
		}
	} else if (oldAdLib.externalId) {
		selector = {
			bucketId: oldAdLib.bucketId,
			studioId: oldAdLib.studioId,
			externalId: oldAdLib.externalId,
		}
	} else {
		return []
	}
	return context.directCollections.BucketAdLibPieces.findFetch(selector)
}
