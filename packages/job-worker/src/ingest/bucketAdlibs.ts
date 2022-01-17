import { BucketId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ShowStyleUserContext } from '../blueprints/context'
import { IBlueprintActionManifest, IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { JobContext } from '../jobs'
import { getSystemVersion } from '../lib'
import {
	BucketActionModifyProps,
	BucketActionRegenerateExpectedPackagesProps,
	BucketEmptyProps,
	BucketItemImportProps,
	BucketPieceModifyProps,
	BucketRemoveAdlibActionProps,
	BucketRemoveAdlibPieceProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import {
	cleanUpExpectedPackagesForBucketAdLibs,
	cleanUpExpectedPackagesForBucketAdLibsActions,
	updateExpectedPackagesForBucketAdLibPiece,
	updateExpectedPackagesForBucketAdLibAction,
} from './expectedPackages'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from './expectedMediaItems'
import { postProcessBucketAction, postProcessBucketAdLib } from '../blueprints/postProcess'
import { omit, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { logger } from '../logging'

function isAdlibAction(adlib: IBlueprintActionManifest | IBlueprintAdLibPiece): adlib is IBlueprintActionManifest {
	return !!(adlib as IBlueprintActionManifest).actionId
}

export async function handleBucketRemoveAdlibPiece(
	context: JobContext,
	data: BucketRemoveAdlibPieceProps
): Promise<void> {
	const piece = await context.directCollections.BucketAdLibPieces.findOne(data.pieceId)
	if (!piece || piece.studioId !== context.studioId)
		throw new Error(`Bucket Piece "${data.pieceId}" not found in this studio`)

	await Promise.all([
		context.directCollections.BucketAdLibPieces.remove(piece._id),
		cleanUpExpectedMediaItemForBucketAdLibPiece(context, [piece._id]),
		cleanUpExpectedPackagesForBucketAdLibs(context, [piece._id]),
	])
}

export async function handleBucketRemoveAdlibAction(
	context: JobContext,
	data: BucketRemoveAdlibActionProps
): Promise<void> {
	const action = await context.directCollections.BucketAdLibActions.findOne(data.actionId)
	if (!action || action.studioId !== context.studioId)
		throw new Error(`Bucket Action "${data.actionId}" not found in this studio`)

	await Promise.all([
		context.directCollections.BucketAdLibActions.remove(action._id),
		cleanUpExpectedMediaItemForBucketAdLibActions(context, [action._id]),
		cleanUpExpectedPackagesForBucketAdLibsActions(context, [action._id]),
	])
}

export async function handleBucketEmpty(context: JobContext, data: BucketEmptyProps): Promise<void> {
	await emptyBucketInner(context, data.bucketId)
}

async function emptyBucketInner(context: JobContext, id: BucketId): Promise<void> {
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

export async function handleBucketItemImport(context: JobContext, data: BucketItemImportProps): Promise<void> {
	const showStyle = await context.getShowStyleCompound(data.showStyleVariantId)
	if (!showStyle) throw new Error(`ShowStyleVariant not found: ${data.showStyleVariantId}`)

	const studio = context.studio

	const blueprint = await context.getShowStyleBlueprint(showStyle._id)

	const watchedPackages = WatchedPackagesHelper.empty(context)

	const context2 = new ShowStyleUserContext(
		{
			name: `Bucket Ad-Lib`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
		},
		studio,
		context.getStudioBlueprintConfig(),
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle),
		watchedPackages
	)

	let rawAdlib: IBlueprintAdLibPiece | IBlueprintActionManifest | null = null
	try {
		if (blueprint.blueprint.getAdlibItem) {
			rawAdlib = blueprint.blueprint.getAdlibItem(context2, data.payload)
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getShowStyleVariantId: ${stringifyError(err)}`)
		rawAdlib = null
	}

	const importVersions: RundownImportVersions = {
		studio: studio._rundownVersionHash,
		showStyleBase: showStyle._rundownVersionHash,
		showStyleVariant: showStyle._rundownVersionHashVariant,
		blueprint: blueprint.blueprint.blueprintVersion,
		core: getSystemVersion(),
	}

	const [oldAdLibPieces, oldAdLibActions] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findFetch({
			externalId: data.payload.externalId,
			showStyleVariantId: showStyle.showStyleVariantId,
			studioId: studio._id,
			bucketId: data.bucketId,
		}),
		context.directCollections.BucketAdLibActions.findFetch({
			externalId: data.payload.externalId,
			showStyleVariantId: showStyle.showStyleVariantId,
			studioId: studio._id,
			bucketId: data.bucketId,
		}),
	])

	if (!rawAdlib) {
		// Cleanup any old copied
		await Promise.all([
			cleanUpExpectedMediaItemForBucketAdLibPiece(
				context,
				oldAdLibPieces.map((adlib) => adlib._id)
			),
			cleanUpExpectedMediaItemForBucketAdLibActions(
				context,
				oldAdLibActions.map((adlib) => adlib._id)
			),
			cleanUpExpectedPackagesForBucketAdLibs(
				context,
				oldAdLibPieces.map((adlib) => adlib._id)
			),
			cleanUpExpectedPackagesForBucketAdLibsActions(
				context,
				oldAdLibActions.map((adlib) => adlib._id)
			),
			oldAdLibPieces.length > 0
				? context.directCollections.BucketAdLibPieces.remove({
						_id: {
							$in: oldAdLibPieces.map((adlib) => adlib._id),
						},
				  })
				: undefined,
			oldAdLibActions.length > 0
				? context.directCollections.BucketAdLibActions.remove({
						_id: {
							$in: oldAdLibActions.map((adlib) => adlib._id),
						},
				  })
				: undefined,
		])
	} else {
		const [highestAdlib, highestAction] = await Promise.all([
			context.directCollections.BucketAdLibPieces.findFetch(
				{
					bucketId: data.bucketId,
				},
				{
					sort: {
						_rank: -1,
					},
					projection: {
						_rank: 1,
					},
					limit: 1,
				}
			),
			context.directCollections.BucketAdLibActions.findFetch(
				{
					bucketId: data.bucketId,
				},
				{
					sort: {
						'display._rank': -1,
					},
					projection: {
						'display._rank': 1,
					},
					limit: 1,
				}
			),
		])
		const newRank = Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0) + 1

		let adlibIdsToRemove = oldAdLibPieces.map((p) => p._id)
		let actionIdsToRemove = oldAdLibActions.map((p) => p._id)

		// let expectedPackages: ExpectedPackageDB[] = []
		// ...generateExpectedPackages(studio, rundownId, pieces, ExpectedPackageDBType.PIECE),

		if (isAdlibAction(rawAdlib)) {
			const action = postProcessBucketAction(
				context2,
				rawAdlib,
				data.payload.externalId,
				blueprint.blueprintId,
				data.bucketId,
				newRank,
				importVersions
			)
			await context.directCollections.BucketAdLibActions.replace(action)

			await Promise.all([
				updateExpectedMediaItemForBucketAdLibAction(context, action),
				updateExpectedPackagesForBucketAdLibAction(context, action),
			])

			// Preserve this one
			actionIdsToRemove = actionIdsToRemove.filter((id) => id !== action._id)
		} else {
			const adlib = postProcessBucketAdLib(
				context2,
				rawAdlib,
				data.payload.externalId,
				blueprint.blueprintId,
				data.bucketId,
				newRank,
				importVersions
			)
			await context.directCollections.BucketAdLibPieces.replace(adlib)

			await Promise.all([
				updateExpectedMediaItemForBucketAdLibPiece(context, adlib),
				updateExpectedPackagesForBucketAdLibPiece(context, adlib),
			])

			// Preserve this one
			adlibIdsToRemove = adlibIdsToRemove.filter((id) => id !== adlib._id)
		}

		// Cleanup the old items
		await Promise.all([
			cleanUpExpectedMediaItemForBucketAdLibPiece(context, adlibIdsToRemove),
			cleanUpExpectedMediaItemForBucketAdLibActions(context, actionIdsToRemove),
			cleanUpExpectedPackagesForBucketAdLibs(context, adlibIdsToRemove),
			cleanUpExpectedPackagesForBucketAdLibsActions(context, actionIdsToRemove),
			context.directCollections.BucketAdLibPieces.remove({ _id: { $in: adlibIdsToRemove } }),
			context.directCollections.BucketAdLibActions.remove({ _id: { $in: actionIdsToRemove } }),
		])
	}
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
	const action = await context.directCollections.BucketAdLibActions.findOne(data.actionId)
	if (!action || action.studioId !== context.studioId)
		throw new Error(`Bucket Action "${data.actionId}" not found in this studio`)

	const newProps = omit(
		data.props as Partial<BucketAdLibAction>,
		'_id',
		'studioId',
		'importVersions',
		'showStyleVariantId'
	)
	await context.directCollections.BucketAdLibActions.update(action._id, {
		$set: newProps,
	})

	const newAction = {
		...action,
		...newProps,
	}

	await Promise.all([
		updateExpectedMediaItemForBucketAdLibAction(context, newAction),
		updateExpectedPackagesForBucketAdLibAction(context, newAction),
	])
}

export async function handleBucketPieceModify(context: JobContext, data: BucketPieceModifyProps): Promise<void> {
	const piece = await context.directCollections.BucketAdLibPieces.findOne(data.pieceId)
	if (!piece || piece.studioId !== context.studioId)
		throw new Error(`Bucket Piece "${data.pieceId}" not found in this studio`)

	const newProps = omit(data.props as Partial<BucketAdLib>, '_id', 'studioId', 'importVersions', 'showStyleVariantId')
	await context.directCollections.BucketAdLibPieces.update(piece._id, {
		$set: newProps,
	})

	const newPiece = {
		...piece,
		...newProps,
	}

	await Promise.all([
		updateExpectedMediaItemForBucketAdLibPiece(context, newPiece),
		updateExpectedPackagesForBucketAdLibPiece(context, newPiece),
	])
}
