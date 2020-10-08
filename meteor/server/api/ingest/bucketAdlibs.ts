import { Meteor } from 'meteor/meteor'
import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { ShowStyleContext, NotesContext } from '../blueprints/context'
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
