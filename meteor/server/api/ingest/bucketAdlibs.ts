import { Meteor } from 'meteor/meteor'
import { IBlueprintActionManifest, IBlueprintAdLibPiece, IngestAdlib } from '@sofie-automation/blueprints-integration'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { ShowStyleContext, NotesContext } from '../blueprints/context'
import { postProcessBucketAction, postProcessBucketAdLib } from '../blueprints/postProcess'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { PackageInfo } from '../../coreSystem'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { BucketId } from '../../../lib/collections/Buckets'
import { PieceId } from '../../../lib/collections/Pieces'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from '../expectedMediaItems'
import { BucketAdLibActions } from '../../../lib/collections/BucketAdlibActions'
import {
	asyncCollectionFindFetch,
	asyncCollectionFindOne,
	asyncCollectionRemove,
	waitForPromiseAll,
} from '../../../lib/lib'
import { syncFunction } from '../../codeControl'
import { bucketSyncFunction } from '../buckets'

function isAdlibAction(adlib: IBlueprintActionManifest | IBlueprintAdLibPiece): adlib is IBlueprintActionManifest {
	return !!(adlib as IBlueprintActionManifest).actionId
}

export function updateBucketAdlibFromIngestData(
	showStyle: ShowStyleCompound,
	studio: Studio,
	bucketId: BucketId,
	ingestData: IngestAdlib
): void {
	const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle)

	const context = new ShowStyleContext(
		studio,
		undefined,
		undefined,
		showStyle._id,
		showStyle.showStyleVariantId,
		new NotesContext('Bucket Ad-Lib', 'bucket-adlib', false)
	)
	if (!blueprint.getAdlibItem) throw new Meteor.Error(501, "This blueprint doesn't support ingest AdLibs")
	const rawAdlib = blueprint.getAdlibItem(context, ingestData)

	const importVersions: RundownImportVersions = {
		studio: studio._rundownVersionHash,
		showStyleBase: showStyle._rundownVersionHash,
		showStyleVariant: showStyle._rundownVersionHashVariant,
		blueprint: blueprint.blueprintVersion,
		core: PackageInfo.version,
	}

	bucketSyncFunction(bucketId, 'updateBucketAdlibFromIngestData', () => {
		const [oldAdLibPieces, oldAdLibActions] = waitForPromiseAll([
			asyncCollectionFindFetch(BucketAdLibs, {
				externalId: ingestData.externalId,
				showStyleVariantId: showStyle.showStyleVariantId,
				studioId: studio._id,
				bucketId,
			}),
			asyncCollectionFindFetch(BucketAdLibActions, {
				externalId: ingestData.externalId,
				showStyleVariantId: showStyle.showStyleVariantId,
				studioId: studio._id,
				bucketId,
			}),
		])

		if (!rawAdlib) {
			// Cleanup any old copied
			waitForPromiseAll([
				cleanUpExpectedMediaItemForBucketAdLibPiece(oldAdLibPieces.map((adlib) => adlib._id)),
				cleanUpExpectedMediaItemForBucketAdLibActions(oldAdLibActions.map((adlib) => adlib._id)),
				oldAdLibPieces.length > 0
					? asyncCollectionRemove(BucketAdLibs, {
							_id: {
								$in: oldAdLibPieces.map((adlib) => adlib._id),
							},
					  })
					: undefined,
				oldAdLibActions.length > 0
					? asyncCollectionRemove(BucketAdLibActions, {
							_id: {
								$in: oldAdLibActions.map((adlib) => adlib._id),
							},
					  })
					: undefined,
			])
			return null
		} else {
			const [highestAdlib, highestAction] = waitForPromiseAll([
				asyncCollectionFindFetch(
					BucketAdLibs,
					{
						bucketId,
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
				),
				asyncCollectionFindFetch(
					BucketAdLibActions,
					{
						bucketId,
					},
					{
						sort: {
							// @ts-ignore
							'display._rank': -1,
						},
						fields: {
							// @ts-ignore
							'display._rank': 1,
						},
						limit: 1,
					}
				),
			])
			const newRank = Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0) + 1

			let adlibIdsToRemove = oldAdLibPieces.map((p) => p._id)
			let actionIdsToRemove = oldAdLibActions.map((p) => p._id)

			if (isAdlibAction(rawAdlib)) {
				const action = postProcessBucketAction(
					context,
					rawAdlib,
					ingestData.externalId,
					blueprintId,
					bucketId,
					newRank,
					importVersions
				)
				BucketAdLibActions.upsert(
					{
						externalId: ingestData.externalId,
						showStyleVariantId: showStyle.showStyleVariantId,
						studioId: studio._id,
						bucketId,
					},
					action
				)

				updateExpectedMediaItemForBucketAdLibAction(action._id)

				// Preserve this one
				actionIdsToRemove = actionIdsToRemove.filter((id) => id !== action._id)
			} else {
				const adlib = postProcessBucketAdLib(
					context,
					rawAdlib,
					ingestData.externalId,
					blueprintId,
					bucketId,
					newRank,
					importVersions
				)
				BucketAdLibs.upsert(
					{
						externalId: ingestData.externalId,
						showStyleVariantId: showStyle.showStyleVariantId,
						studioId: studio._id,
						bucketId,
					},
					adlib
				)

				updateExpectedMediaItemForBucketAdLibPiece(adlib._id)

				// Preserve this one
				adlibIdsToRemove = adlibIdsToRemove.filter((id) => id !== adlib._id)
			}

			// Cleanup the old items
			waitForPromiseAll([
				cleanUpExpectedMediaItemForBucketAdLibPiece(adlibIdsToRemove),
				cleanUpExpectedMediaItemForBucketAdLibActions(actionIdsToRemove),
				asyncCollectionRemove(BucketAdLibs, { _id: { $in: adlibIdsToRemove } }),
				asyncCollectionRemove(BucketAdLibActions, { _id: { $in: actionIdsToRemove } }),
			])
		}
	})
}
