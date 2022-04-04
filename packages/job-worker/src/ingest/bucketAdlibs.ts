import { BucketId, PieceId, AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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
import { createShowStyleCompound } from '../showStyles'
import { MongoQuery } from '../db'

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
	const studio = context.studio

	const [showStyleBase, allShowStyleVariants, allOldAdLibPieces, allOldAdLibActions, blueprint] = await Promise.all([
		context.getShowStyleBase(data.showStyleBaseId),
		context.getShowStyleVariants(data.showStyleBaseId),
		context.directCollections.BucketAdLibPieces.findFetch({
			externalId: data.payload.externalId,
			showStyleBaseId: data.showStyleBaseId,
			studioId: studio._id,
			bucketId: data.bucketId,
		}),
		context.directCollections.BucketAdLibActions.findFetch({
			externalId: data.payload.externalId,
			showStyleBaseId: data.showStyleBaseId,
			studioId: studio._id,
			bucketId: data.bucketId,
		}),
		context.getShowStyleBlueprint(data.showStyleBaseId),
	])

	if (!showStyleBase) throw new Error(`ShowStyleBase "${data.showStyleBaseId}" not found`)

	const showStyleVariants = allShowStyleVariants.filter((v) => {
		if (data.showStyleVariantIds) return data.showStyleVariantIds.includes(v._id)
		else return true
	})
	if (showStyleVariants.length === 0) throw new Error(`No ShowStyleVariants found for ${data.showStyleBaseId}`)

	let adlibIdsToRemove = allOldAdLibPieces.map((p) => p._id)
	let actionIdsToRemove = allOldAdLibActions.map((p) => p._id)

	let newRank: number | undefined = undefined
	let onlyGenerateOneItem = false

	const ps: Promise<any>[] = []
	let isFirstShowStyleVariant = true
	for (const showStyleVariant of showStyleVariants) {
		const showStyleCompound = createShowStyleCompound(showStyleBase, showStyleVariant)

		if (!showStyleCompound)
			throw new Error(`Unable to create a ShowStyleCompound for ${showStyleBase._id}, ${showStyleVariant._id} `)

		const watchedPackages = WatchedPackagesHelper.empty(context)

		const contextForVariant = new ShowStyleUserContext(
			{
				name: `Bucket Ad-Lib`,
				identifier: `studioId=${context.studioId},showStyleBaseId=${showStyleBase._id},showStyleVariantId=${showStyleVariant._id}`,
				tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
			},
			studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			watchedPackages
		)

		let rawAdlib: IBlueprintAdLibPiece | IBlueprintActionManifest | null = null
		try {
			if (blueprint.blueprint.getAdlibItem) {
				rawAdlib = blueprint.blueprint.getAdlibItem(contextForVariant, data.payload)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.getShowStyleVariantId: ${stringifyError(err)}`)
			rawAdlib = null
		}

		const importVersions: RundownImportVersions = {
			studio: studio._rundownVersionHash,
			showStyleBase: showStyleCompound._rundownVersionHash,
			showStyleVariant: showStyleCompound._rundownVersionHashVariant,
			blueprint: blueprint.blueprint.blueprintVersion,
			core: getSystemVersion(),
		}

		if (rawAdlib) {
			// Cache the newRank, so we only have to calculate it once:
			if (newRank === undefined) {
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
					) as Promise<Array<Pick<BucketAdLib, '_rank'>>>,
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
					) as Promise<Array<{ display: Pick<BucketAdLibAction['display'], '_rank'> }>>,
				])
				newRank = Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0) + 1
			} else {
				newRank++
			}

			if (isAdlibAction(rawAdlib)) {
				if (isFirstShowStyleVariant) {
					if (rawAdlib.allVariants) {
						// If the adlib can be used by all variants, we only should only generate it once.
						onlyGenerateOneItem = true
					}
				} else {
					delete rawAdlib.allVariants
				}
				const action: BucketAdLibAction = postProcessBucketAction(
					contextForVariant,
					rawAdlib,
					data.payload.externalId,
					blueprint.blueprintId,
					data.bucketId,
					newRank,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibActions.replace(action),
					updateExpectedMediaItemForBucketAdLibAction(context, action),
					updateExpectedPackagesForBucketAdLibAction(context, action)
				)

				// Preserve this one
				actionIdsToRemove = actionIdsToRemove.filter((id) => id !== action._id)
			} else {
				const adlib = postProcessBucketAdLib(
					contextForVariant,
					rawAdlib,
					data.payload.externalId,
					blueprint.blueprintId,
					data.bucketId,
					newRank,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibPieces.replace(adlib),
					updateExpectedMediaItemForBucketAdLibPiece(context, adlib),
					updateExpectedPackagesForBucketAdLibPiece(context, adlib)
				)

				// Preserve this one
				adlibIdsToRemove = adlibIdsToRemove.filter((id) => id !== adlib._id)
			}

			if (onlyGenerateOneItem) {
				// We only need to generate one variant, so we can stop here
				break
			}
		}
		isFirstShowStyleVariant = false
	}

	// Cleanup old items:
	ps.push(
		cleanUpExpectedMediaItemForBucketAdLibPiece(context, adlibIdsToRemove),
		cleanUpExpectedMediaItemForBucketAdLibActions(context, actionIdsToRemove),
		cleanUpExpectedPackagesForBucketAdLibs(context, adlibIdsToRemove),
		cleanUpExpectedPackagesForBucketAdLibsActions(context, actionIdsToRemove),
		adlibIdsToRemove.length
			? context.directCollections.BucketAdLibPieces.remove({ _id: { $in: adlibIdsToRemove } })
			: Promise.resolve(),
		actionIdsToRemove.length
			? context.directCollections.BucketAdLibActions.remove({ _id: { $in: actionIdsToRemove } })
			: Promise.resolve()
	)
	await Promise.all(ps)
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

	const newProps = omit(
		data.props as Partial<BucketAdLibAction>,
		'_id',
		'studioId',
		'importVersions',
		'showStyleVariantId'
	)

	// Also update adlibs that are grouped together with this adlib in the GUI:
	const actionsToUpdate = await getGroupedAdlibActions(context, orgAction)

	for (const action of actionsToUpdate) {
		const newAction = {
			...action,
			...newProps,
		}
		await Promise.all([
			context.directCollections.BucketAdLibActions.update(action._id, {
				$set: newProps,
			}),
			updateExpectedMediaItemForBucketAdLibAction(context, newAction),
			updateExpectedPackagesForBucketAdLibAction(context, newAction),
		])
	}
}

export async function handleBucketPieceModify(context: JobContext, data: BucketPieceModifyProps): Promise<void> {
	const orgPiece = await context.directCollections.BucketAdLibPieces.findOne(data.pieceId)
	if (!orgPiece || orgPiece.studioId !== context.studioId)
		throw new Error(`Bucket Piece "${data.pieceId}" not found in this studio`)

	const newProps = omit(data.props as Partial<BucketAdLib>, '_id', 'studioId', 'importVersions', 'showStyleVariantId')

	// Also update adlibs that are grouped together with this adlib in the GUI:
	const piecesToUpdate = await getGroupedAdlibs(context, orgPiece)

	for (const piece of piecesToUpdate) {
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
