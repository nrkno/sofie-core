import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ShowStyleUserContext } from '../../blueprints/context'
import { IBlueprintActionManifest, IBlueprintAdLibPiece, IngestAdlib } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getSystemVersion } from '../../lib'
import { BucketItemImportProps, BucketItemRegenerateProps } from '@sofie-automation/corelib/dist/worker/ingest'
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
import { postProcessBucketAction, postProcessBucketAdLib } from '../../blueprints/postProcess'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { BucketAdLib, BucketAdLibIngestInfo } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { logger } from '../../logging'
import { createShowStyleCompound } from '../../showStyles'
import { isAdlibAction } from './util'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export async function handleBucketItemImport(context: JobContext, data: BucketItemImportProps): Promise<void> {
	await regenerateBucketItemFromIngestInfo(context, data.bucketId, data.showStyleBaseId, {
		limitToShowStyleVariantIds: data.showStyleVariantIds,
		payload: data.payload,
	})
}

export async function handleBucketItemRegenerate(context: JobContext, data: BucketItemRegenerateProps): Promise<void> {
	// These queries could match more than one document, but as they have the same `externalId` they all get regenerated together
	const [adlibPiece, adlibAction] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findOne(
			{
				externalId: data.externalId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{
				projection: {
					showStyleBaseId: 1,
					ingestInfo: 1,
				},
			}
		) as Promise<Pick<BucketAdLib, 'showStyleBaseId' | 'ingestInfo'>> | undefined,
		context.directCollections.BucketAdLibActions.findOne(
			{
				externalId: data.externalId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{
				projection: {
					showStyleBaseId: 1,
					ingestInfo: 1,
				},
			}
		) as Promise<Pick<BucketAdLibAction, 'showStyleBaseId' | 'ingestInfo'>> | undefined,
	])

	// TODO - UserErrors?
	if (adlibAction) {
		if (!adlibAction.ingestInfo) throw new Error(`Bucket AdLibAction cannot be resynced, it has no ingest data`)
		await regenerateBucketItemFromIngestInfo(
			context,
			data.bucketId,
			adlibAction.showStyleBaseId,
			adlibAction.ingestInfo
		)
	} else if (adlibPiece) {
		if (!adlibPiece.ingestInfo) throw new Error(`Bucket AdLibPiece cannot be resynced, it has no ingest data`)
		await regenerateBucketItemFromIngestInfo(
			context,
			data.bucketId,
			adlibPiece.showStyleBaseId,
			adlibPiece.ingestInfo
		)
	} else {
		throw new Error(`No Bucket Items with externalId "${data.externalId}" were found`)
	}
}

async function regenerateBucketItemFromIngestInfo(
	context: JobContext,
	bucketId: BucketId,
	showStyleBaseId: ShowStyleBaseId,
	ingestInfo: BucketAdLibIngestInfo
): Promise<void> {
	const [showStyleBase, allShowStyleVariants, allOldAdLibPieces, allOldAdLibActions, blueprint] = await Promise.all([
		context.getShowStyleBase(showStyleBaseId),
		context.getShowStyleVariants(showStyleBaseId),
		context.directCollections.BucketAdLibPieces.findFetch(
			{
				externalId: ingestInfo.payload.externalId,
				showStyleBaseId: showStyleBaseId,
				studioId: context.studio._id,
				bucketId: bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLib, '_id'>[]>,
		context.directCollections.BucketAdLibActions.findFetch(
			{
				externalId: ingestInfo.payload.externalId,
				showStyleBaseId: showStyleBaseId,
				studioId: context.studio._id,
				bucketId: bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLibAction, '_id'>[]>,
		context.getShowStyleBlueprint(showStyleBaseId),
	])

	if (!showStyleBase) throw new Error(`ShowStyleBase "${showStyleBaseId}" not found`)

	const showStyleVariants = allShowStyleVariants.filter(
		(v) => !ingestInfo.limitToShowStyleVariantIds || ingestInfo.limitToShowStyleVariantIds.includes(v._id)
	)
	if (showStyleVariants.length === 0) throw new Error(`No ShowStyleVariants found for ${showStyleBaseId}`)

	const adlibIdsToRemove = new Set(allOldAdLibPieces.map((p) => p._id))
	const actionIdsToRemove = new Set(allOldAdLibActions.map((p) => p._id))

	let isFirstShowStyleVariant = true
	let newRank: number | undefined = undefined
	let onlyGenerateOneItem = false

	const ps: Promise<any>[] = []
	for (const showStyleVariant of showStyleVariants) {
		const showStyleCompound = createShowStyleCompound(showStyleBase, showStyleVariant)
		if (!showStyleCompound)
			throw new Error(`Unable to create a ShowStyleCompound for ${showStyleBase._id}, ${showStyleVariant._id} `)

		const rawAdlib = await generateBucketAdlibForVariant(context, blueprint, showStyleCompound, ingestInfo.payload)

		if (rawAdlib) {
			const importVersions: RundownImportVersions = {
				studio: context.studio._rundownVersionHash,
				showStyleBase: showStyleCompound._rundownVersionHash,
				showStyleVariant: showStyleCompound._rundownVersionHashVariant,
				blueprint: blueprint.blueprint.blueprintVersion,
				core: getSystemVersion(),
			}

			// Cache the newRank, so we only have to calculate it once:
			if (newRank === undefined) {
				newRank = (await calculateHighestRankInBucket(context, bucketId)) + 1
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
					context,
					showStyleCompound,
					rawAdlib,
					ingestInfo,
					blueprint.blueprintId,
					bucketId,
					newRank,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibActions.replace(action),
					updateExpectedMediaItemForBucketAdLibAction(context, action),
					updateExpectedPackagesForBucketAdLibAction(context, action)
				)

				// Preserve this one
				actionIdsToRemove.delete(action._id)
			} else {
				const adlib = postProcessBucketAdLib(
					context,
					showStyleCompound,
					rawAdlib,
					ingestInfo,
					blueprint.blueprintId,
					bucketId,
					newRank,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibPieces.replace(adlib),
					updateExpectedMediaItemForBucketAdLibPiece(context, adlib),
					updateExpectedPackagesForBucketAdLibPiece(context, adlib)
				)

				// Preserve this one
				adlibIdsToRemove.delete(adlib._id)
			}

			if (onlyGenerateOneItem) {
				// We only need to generate one variant, so we can stop here
				break
			}
		}
		isFirstShowStyleVariant = false
	}

	// Cleanup old items:
	if (adlibIdsToRemove.size > 0) {
		const adlibIdsToRemoveArray = Array.from(adlibIdsToRemove)

		ps.push(
			cleanUpExpectedMediaItemForBucketAdLibPiece(context, adlibIdsToRemoveArray),
			cleanUpExpectedPackagesForBucketAdLibs(context, adlibIdsToRemoveArray),
			context.directCollections.BucketAdLibPieces.remove({ _id: { $in: adlibIdsToRemoveArray } })
		)
	}
	if (actionIdsToRemove.size > 0) {
		const actionIdsToRemoveArray = Array.from(actionIdsToRemove)

		ps.push(
			cleanUpExpectedMediaItemForBucketAdLibActions(context, actionIdsToRemoveArray),
			cleanUpExpectedPackagesForBucketAdLibsActions(context, actionIdsToRemoveArray),
			context.directCollections.BucketAdLibActions.remove({ _id: { $in: actionIdsToRemoveArray } })
		)
	}
	await Promise.all(ps)
}

async function generateBucketAdlibForVariant(
	context: JobContext,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	// pieceId: BucketAdLibId | BucketAdLibActionId,
	payload: IngestAdlib
): Promise<IBlueprintAdLibPiece | IBlueprintActionManifest | null> {
	const watchedPackages = await WatchedPackagesHelper.create(context, context.studio._id, {
		// We don't know what the `pieceId` will be, but we do know the `externalId`
		pieceExternalId: payload.externalId,
		fromPieceType: {
			$in: [ExpectedPackageDBType.BUCKET_ADLIB, ExpectedPackageDBType.BUCKET_ADLIB_ACTION],
		},
	})

	const contextForVariant = new ShowStyleUserContext(
		{
			name: `Bucket Ad-Lib`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyleCompound._id},showStyleVariantId=${showStyleCompound.showStyleVariantId}`,
			tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
		},
		context,
		showStyleCompound,
		watchedPackages
	)

	try {
		if (blueprint.blueprint.getAdlibItem) {
			return blueprint.blueprint.getAdlibItem(contextForVariant, payload)
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getShowStyleVariantId: ${stringifyError(err)}`)
	}
	return null
}

async function calculateHighestRankInBucket(context: JobContext, bucketId: BucketId): Promise<number> {
	const [highestAdlib, highestAction] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findFetch(
			{
				bucketId: bucketId,
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
				bucketId: bucketId,
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

	return Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0)
}
