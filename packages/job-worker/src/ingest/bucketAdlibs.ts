import { BucketId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { ShowStyleUserContext } from '../blueprints/context'
import { IBlueprintActionManifest, IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { JobContext } from '../jobs'
import { getSystemVersion } from '../lib'
import {
	BucketEmptyProps,
	BucketItemImportProps,
	BucketRemoveAdlibActionProps,
	BucketRemoveAdlibPieceProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { getShowStyleCompound } from '../showStyles'
import {
	cleanUpExpectedPackagesForBucketAdLibs,
	cleanUpExpectedPackagesForBucketAdLibsActions,
	updateExpectedPackagesForBucketAdLib,
	updateExpectedPackagesForBucketAdLibAction,
} from './expectedPackages'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from './expectedMediaItems'
import { postProcessBucketAction, postProcessBucketAdLib } from '../blueprints/postProcess'

function isAdlibAction(adlib: IBlueprintActionManifest | IBlueprintAdLibPiece): adlib is IBlueprintActionManifest {
	return !!(adlib as IBlueprintActionManifest).actionId
}

export async function handleBucketRemoveAdlibPiece(
	context: JobContext,
	data: BucketRemoveAdlibPieceProps
): Promise<void> {
	const piece = await context.directCollections.BucketAdLibPieces.findOne(data.itemId)
	if (!piece || piece.studioId !== context.studioId) throw new Error(`BucketAdLibPiece "${data.itemId}" not found`)

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
	const action = await context.directCollections.BucketAdLibActions.findOne(data.itemId)
	if (!action || action.studioId !== context.studioId) throw new Error(`BucketAdLibAction "${data.itemId}" not found`)

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
		// TODO - remove packages?
	])
}

export async function handleBucketItemImport(context: JobContext, data: BucketItemImportProps): Promise<void> {
	const showStyle = await getShowStyleCompound(context, data.showStyleVariantId)
	if (!showStyle) throw new Error(`ShowStyleVariant not found: ${data.showStyleVariantId}`)

	const studio = context.studio

	const blueprint = await loadShowStyleBlueprint(context.directCollections, showStyle)

	const watchedPackages = WatchedPackagesHelper.empty(context)

	const context2 = new ShowStyleUserContext(
		{
			name: `Bucket Ad-Lib`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
		},
		studio,
		context.studioBlueprint,
		showStyle,
		blueprint,
		watchedPackages
	)
	if (!blueprint.blueprint.getAdlibItem) throw new Error("This blueprint doesn't support ingest AdLibs")
	const rawAdlib = blueprint.blueprint.getAdlibItem(context2, data.payload)

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
				updateExpectedPackagesForBucketAdLibAction(context, studio, action),
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
				updateExpectedPackagesForBucketAdLib(context, studio, adlib),
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
