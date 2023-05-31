import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ShowStyleUserContext } from '../../blueprints/context'
import { IBlueprintActionManifest, IBlueprintAdLibPiece, IngestAdlib } from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getSystemVersion } from '../../lib'
import { BucketItemImportProps } from '@sofie-automation/corelib/dist/worker/ingest'
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
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { logger } from '../../logging'
import { createShowStyleCompound } from '../../showStyles'
import { isAdlibAction } from './util'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { IMongoTransaction } from '../../db'
import { BucketId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function handleBucketItemImport(context: JobContext, data: BucketItemImportProps): Promise<void> {
	const [showStyleBase, allShowStyleVariants, allOldAdLibPieces, allOldAdLibActions, blueprint] = await Promise.all([
		context.getShowStyleBase(data.showStyleBaseId),
		context.getShowStyleVariants(data.showStyleBaseId),
		context.directCollections.BucketAdLibPieces.findFetch(
			{
				externalId: data.payload.externalId,
				showStyleBaseId: data.showStyleBaseId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLib, '_id'>[]>,
		context.directCollections.BucketAdLibActions.findFetch(
			{
				externalId: data.payload.externalId,
				showStyleBaseId: data.showStyleBaseId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLibAction, '_id'>[]>,
		context.getShowStyleBlueprint(data.showStyleBaseId),
	])

	if (!showStyleBase) throw new Error(`ShowStyleBase "${data.showStyleBaseId}" not found`)

	const showStyleVariants = allShowStyleVariants.filter((v) => {
		if (data.showStyleVariantIds) return data.showStyleVariantIds.includes(v._id)
		else return true
	})
	if (showStyleVariants.length === 0) throw new Error(`No ShowStyleVariants found for ${data.showStyleBaseId}`)

	const adlibIdsToRemove = new Set(allOldAdLibPieces.map((p) => p._id))
	const actionIdsToRemove = new Set(allOldAdLibActions.map((p) => p._id))

	await context.directCollections.runInTransaction(async (transaction) => {
		let isFirstShowStyleVariant = true
		let newRank: number | undefined = undefined
		let onlyGenerateOneItem = false

		const ps: Promise<any>[] = []
		for (const showStyleVariant of showStyleVariants) {
			const showStyleCompound = createShowStyleCompound(showStyleBase, showStyleVariant)
			if (!showStyleCompound)
				throw new Error(
					`Unable to create a ShowStyleCompound for ${showStyleBase._id}, ${showStyleVariant._id} `
				)

			const rawAdlib = generateBucketAdlibForVariant(context, blueprint, showStyleCompound, data.payload)

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
					newRank = (await calculateHighestRankInBucket(context, transaction, data.bucketId)) + 1
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
						data.payload.externalId,
						blueprint.blueprintId,
						data.bucketId,
						newRank,
						importVersions
					)

					ps.push(
						context.directCollections.BucketAdLibActions.replace(action, transaction),
						updateExpectedMediaItemForBucketAdLibAction(context, transaction, action),
						updateExpectedPackagesForBucketAdLibAction(context, transaction, action)
					)

					// Preserve this one
					actionIdsToRemove.delete(action._id)
				} else {
					const adlib = postProcessBucketAdLib(
						context,
						showStyleCompound,
						rawAdlib,
						data.payload.externalId,
						blueprint.blueprintId,
						data.bucketId,
						newRank,
						importVersions
					)

					ps.push(
						context.directCollections.BucketAdLibPieces.replace(adlib, transaction),
						updateExpectedMediaItemForBucketAdLibPiece(context, transaction, adlib),
						updateExpectedPackagesForBucketAdLibPiece(context, transaction, adlib)
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
				cleanUpExpectedMediaItemForBucketAdLibPiece(context, transaction, adlibIdsToRemoveArray),
				cleanUpExpectedPackagesForBucketAdLibs(context, transaction, adlibIdsToRemoveArray),
				context.directCollections.BucketAdLibPieces.remove({ _id: { $in: adlibIdsToRemoveArray } }, transaction)
			)
		}
		if (actionIdsToRemove.size > 0) {
			const actionIdsToRemoveArray = Array.from(actionIdsToRemove)

			ps.push(
				cleanUpExpectedMediaItemForBucketAdLibActions(context, transaction, actionIdsToRemoveArray),
				cleanUpExpectedPackagesForBucketAdLibsActions(context, transaction, actionIdsToRemoveArray),
				context.directCollections.BucketAdLibActions.remove(
					{ _id: { $in: actionIdsToRemoveArray } },
					transaction
				)
			)
		}
		await Promise.all(ps)
	})
}

function generateBucketAdlibForVariant(
	context: JobContext,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	payload: IngestAdlib
): IBlueprintAdLibPiece | IBlueprintActionManifest | null {
	const watchedPackages = WatchedPackagesHelper.empty(context)

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

async function calculateHighestRankInBucket(
	context: JobContext,
	transaction: IMongoTransaction,
	bucketId: BucketId
): Promise<number> {
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
			},
			transaction
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
			},
			transaction
		) as Promise<Array<{ display: Pick<BucketAdLibAction['display'], '_rank'> }>>,
	])

	return Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0)
}
