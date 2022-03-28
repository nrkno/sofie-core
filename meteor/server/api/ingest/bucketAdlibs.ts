import { IBlueprintActionManifest, IBlueprintAdLibPiece, IngestAdlib } from '@sofie-automation/blueprints-integration'
import { ShowStyleVariantId, ShowStyleVariants } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { postProcessBucketAction, postProcessBucketAdLib } from '../blueprints/postProcess'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { PackageInfo } from '../../coreSystem'
import { BucketAdLib, BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { BucketId } from '../../../lib/collections/Buckets'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from './expectedMediaItems'
import { BucketAdLibAction, BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'
import { bucketSyncFunction } from '../buckets'
import {
	cleanUpExpectedPackagesForBucketAdLibs,
	cleanUpExpectedPackagesForBucketAdLibsActions,
	updateExpectedPackagesForBucketAdLib,
	updateExpectedPackagesForBucketAdLibAction,
} from './expectedPackages'
import { ShowStyleUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { logger } from '../../logging'
import { stringifyError } from '../../../lib/lib'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { createShowStyleCompound } from '../showStyles'

function isAdlibAction(adlib: IBlueprintActionManifest | IBlueprintAdLibPiece): adlib is IBlueprintActionManifest {
	return !!(adlib as IBlueprintActionManifest).actionId
}

export async function updateBucketAdlibFromIngestData(
	showStyleBase: ShowStyleBase,
	showStyleVariantId: ShowStyleVariantId | undefined,
	studio: Studio,
	bucketId: BucketId,
	ingestData: IngestAdlib
): Promise<void> {
	// Temporary note: This function is reworked significantly in a late addition to Release 38.
	// This rework is a back-port of new functionality already implemented in Release 41+ ( https://github.com/nrkno/sofie-core/pull/689 ),
	// so any merge conflicts should be resolved by picking the Release 41+ version.
	// (and when doing so, this message can be removed)
	// /Johan Nyman 2022-03-28

	const pBlueprint = loadShowStyleBlueprint(showStyleBase)

	const showStyleVariants = await ShowStyleVariants.findFetchAsync(
		showStyleVariantId
			? {
					_id: showStyleVariantId,
					showStyleBaseId: showStyleBase._id,
			  }
			: {
					showStyleBaseId: showStyleBase._id,
			  },
		{
			sort: {
				name: 1,
				_id: 1,
			},
		}
	)
	if (showStyleVariants.length === 0) throw new Error(`No ShowStyleVariants found for ${showStyleBase._id}`)

	const { blueprint, blueprintId } = await pBlueprint

	await bucketSyncFunction(bucketId, 'updateBucketAdlibFromIngestData', async () => {
		const [allOldAdLibPieces, allOldAdLibActions] = await Promise.all([
			BucketAdLibs.findFetchAsync({
				externalId: ingestData.externalId,
				showStyleBaseId: showStyleBase._id,
				studioId: studio._id,
				bucketId,
			}),
			BucketAdLibActions.findFetchAsync({
				externalId: ingestData.externalId,
				showStyleBaseId: showStyleBase._id,
				studioId: studio._id,
				bucketId,
			}),
		])

		let adlibIdsToRemove = allOldAdLibPieces.map((p) => p._id)
		let actionIdsToRemove = allOldAdLibActions.map((p) => p._id)

		let newRank: number | undefined = undefined
		let onlyGenerateOneItem = false

		const ps: Promise<any>[] = []
		let isFirstShowStyleVariant = true
		for (const showStyleVariant of showStyleVariants) {
			const showStyleCompound = createShowStyleCompound(showStyleBase, showStyleVariant)
			if (!showStyleCompound)
				throw new Error(
					`Unable to create a ShowStyleCompound for ${showStyleBase._id}, ${showStyleVariant._id} `
				)

			const watchedPackages = WatchedPackagesHelper.empty()

			const contextForVariant = new ShowStyleUserContext(
				{
					name: `Bucket Ad-Lib`,
					identifier: `studioId=${studio._id},showStyleBaseId=${showStyleBase._id},showStyleVariantId=${showStyleVariantId}`,
					tempSendUserNotesIntoBlackHole: true, // TODO-CONTEXT
				},
				studio,
				showStyleCompound,
				watchedPackages
			)

			let rawAdlib: IBlueprintAdLibPiece | IBlueprintActionManifest | null = null
			try {
				if (blueprint.getAdlibItem) {
					rawAdlib = blueprint.getAdlibItem(contextForVariant, ingestData)
				}
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.getAdlibItem: ${stringifyError(err)}`)
				rawAdlib = null
			}

			const importVersions: RundownImportVersions = {
				studio: studio._rundownVersionHash,
				showStyleBase: showStyleCompound._rundownVersionHash,
				showStyleVariant: showStyleCompound._rundownVersionHashVariant,
				blueprint: blueprint.blueprintVersion,
				core: PackageInfo.version,
			}

			if (rawAdlib) {
				// Cache the newRank, so we only have to calculate it once:
				if (newRank === undefined) {
					const [highestAdlib, highestAction] = await Promise.all([
						BucketAdLibs.findFetchAsync(
							{
								bucketId: bucketId,
							},
							{
								sort: {
									_rank: -1,
								},
								fields: {
									_rank: 1,
								},
								limit: 1,
							}
						) as Promise<Array<Pick<BucketAdLib, '_rank'>>>,
						BucketAdLibActions.findFetchAsync(
							{
								bucketId: bucketId,
							},
							{
								sort: {
									// @ts-expect-error deep property
									'display._rank': -1,
								},
								fields: {
									// @ts-expect-error deep property
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
						ingestData.externalId,
						blueprintId,
						bucketId,
						newRank,
						importVersions
					)

					ps.push(
						BucketAdLibActions.upsertAsync(
							{
								externalId: ingestData.externalId,
								showStyleBaseId: showStyleBase._id,
								showStyleVariantId: showStyleCompound.showStyleVariantId,
								studioId: studio._id,
								bucketId,
							},
							action
						),
						updateExpectedMediaItemForBucketAdLibAction(action._id),
						updateExpectedPackagesForBucketAdLibAction(action._id)
					)

					// Preserve this one
					actionIdsToRemove = actionIdsToRemove.filter((id) => id !== action._id)
				} else {
					const adlib = postProcessBucketAdLib(
						contextForVariant,
						rawAdlib,
						ingestData.externalId,
						blueprintId,
						bucketId,
						newRank,
						importVersions
					)

					ps.push(
						BucketAdLibs.upsertAsync(
							{
								externalId: ingestData.externalId,
								showStyleBaseId: showStyleBase._id,
								showStyleVariantId: showStyleCompound.showStyleVariantId,
								studioId: studio._id,
								bucketId,
							},
							adlib
						),
						updateExpectedMediaItemForBucketAdLibPiece(adlib._id),
						updateExpectedPackagesForBucketAdLib(adlib._id)
					)

					// Preserve this one
					adlibIdsToRemove = adlibIdsToRemove.filter((id) => id !== adlib._id)
				}

				if (onlyGenerateOneItem) {
					// We only need to generate one variant, so we can stop here
					break
				}
				isFirstShowStyleVariant = false
			}
			// Cleanup old items:
			ps.push(
				cleanUpExpectedMediaItemForBucketAdLibPiece(adlibIdsToRemove),
				cleanUpExpectedMediaItemForBucketAdLibActions(actionIdsToRemove),
				cleanUpExpectedPackagesForBucketAdLibs(adlibIdsToRemove),
				cleanUpExpectedPackagesForBucketAdLibsActions(actionIdsToRemove),
				adlibIdsToRemove.length
					? BucketAdLibs.removeAsync({ _id: { $in: adlibIdsToRemove } })
					: Promise.resolve(),
				actionIdsToRemove.length
					? BucketAdLibActions.removeAsync({ _id: { $in: actionIdsToRemove } })
					: Promise.resolve()
			)
			await Promise.all(ps)
		}
	})
}
