import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../lib/collections/Studios'
import { getBlueprintOfRundown, loadShowStyleBlueprints } from '../blueprints/cache'
import { ShowStyleContext, NotesContext } from '../blueprints/context'
import { postProcessAdLibPieces, postProcessBucketAdLib } from '../blueprints/postProcess'
import { RundownImportVersions } from '../../../lib/collections/Rundowns'
import { PackageInfo } from '../../coreSystem'
import { BucketAdLibs } from '../../../lib/collections/BucketAdlibs'
import { BucketId } from '../../../lib/collections/Buckets'
import { PieceId } from '../../../lib/collections/Pieces'

export function updateBucketAdlibFromIngestData(showStyle: ShowStyleCompound, studio: Studio, bucketId: BucketId, ingestData: IngestAdlib): PieceId | null {
	const { blueprint, blueprintId } = loadShowStyleBlueprints(showStyle)

	const context = new ShowStyleContext(studio, showStyle._id, showStyle.showStyleVariantId, new NotesContext('Bucket Ad-Lib', 'bucket-adlib', false))
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
		BucketAdLibs.remove({
			externalId: ingestData.externalId,
			showStyleVariantId: showStyle.showStyleVariantId,
			studioId: studio._id
		})

		return null
	} else {
		const adlib = postProcessBucketAdLib(context, rawAdlib, blueprintId, bucketId, importVersions)

		BucketAdLibs.upsert({
			externalId: ingestData.externalId,
			showStyleVariantId: showStyle.showStyleVariantId,
			studioId: studio._id
		}, adlib)

		return adlib._id
	}
}