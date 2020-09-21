import { Meteor } from 'meteor/meteor'
import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { ShowStyleUserContext } from '../blueprints/context'
import { postProcessBucketAdLib } from '../blueprints/postProcess'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { PackageInfo } from '../../coreSystem'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { BucketId } from '../../../lib/collections/Buckets'
import { PieceId } from '../../../lib/collections/Pieces'
import {
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibPiece,
} from '../expectedMediaItems'

export function updateBucketAdlibFromIngestData(
	showStyle: ShowStyleCompound,
	studio: Studio,
	bucketId: BucketId,
	ingestData: IngestAdlib
): PieceId | null {
	const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle)

	// const blueprintIds: Set<string> = new Set<string>()
	// if (blueprintId) {
	// 	blueprintIds.add(unprotectString(blueprintId))
	// }
	// if (studio.blueprintId) {
	// 	blueprintIds.add(unprotectString(studio.blueprintId))
	// }

	const context = new ShowStyleUserContext(
		{
			name: `Bucket Ad-Lib`,
			identifier: `studioId=${studio._id},showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			blackHoleUserNotes: true, // TODO-CONTEXT
		},
		studio,
		undefined,
		undefined,
		showStyle._id,
		showStyle.showStyleVariantId
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

	if (!rawAdlib) {
		// Cleanup any old copied
		const oldAdLibs = BucketAdLibs.find({
			externalId: ingestData.externalId,
			showStyleVariantId: showStyle.showStyleVariantId,
			studioId: studio._id,
		}).fetch()

		cleanUpExpectedMediaItemForBucketAdLibPiece(oldAdLibs.map((adlib) => adlib._id))

		BucketAdLibs.remove({
			_id: {
				$in: oldAdLibs.map((adlib) => adlib._id),
			},
		})
		return null
	} else {
		const newRank =
			(
				BucketAdLibs.find(
					{
						bucketId,
					},
					{
						sort: {
							_rank: 1,
						},
						fields: {
							_rank: 1,
						},
					}
				)
					.fetch()
					.reverse()[0] || { _rank: 0 }
			)._rank + 1

		const adlib = postProcessBucketAdLib(context, rawAdlib, blueprintId, bucketId, newRank, importVersions)
		BucketAdLibs.upsert(
			{
				externalId: ingestData.externalId,
				showStyleVariantId: showStyle.showStyleVariantId,
				studioId: studio._id,
				bucketId,
			},
			adlib
		)

		updateExpectedMediaItemForBucketAdLibPiece(adlib._id, adlib.bucketId)

		return adlib._id
	}
}
