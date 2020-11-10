import { PieceId } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { IBlueprintActionManifest } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownImportVersions } from './Rundowns'
import { StudioId } from './Studios'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { BucketId } from './Buckets'
import { registerIndex } from '../database'
import { AdLibActionId } from './AdLibActions'

export interface BucketAdLibAction extends IBlueprintActionManifest {
	_id: AdLibActionId
	bucketId: BucketId

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibActions: TransformedCollection<BucketAdLibAction, BucketAdLibAction> = createMongoCollection<
	BucketAdLibAction
>('bucketAdlibActions')
registerCollection('BucketAdLibActions', BucketAdLibActions)

registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})
