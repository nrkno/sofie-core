import { PieceId } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { IBlueprintActionManifest } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownImportVersions } from './Rundowns'
import { StudioId } from './Studios'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { BucketId } from './Buckets'
import { registerIndex } from '../database'
import { AdLibActionId } from './AdLibActions'

export type BucketAdLibActionId = AdLibActionId
export interface BucketAdLibAction extends Omit<IBlueprintActionManifest, 'partId'> {
	_id: BucketAdLibActionId
	bucketId: BucketId

	externalId: string

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibActions: TransformedCollection<
	BucketAdLibAction,
	BucketAdLibAction
> = createMongoCollection<BucketAdLibAction>('bucketAdlibActions')
registerCollection('BucketAdLibActions', BucketAdLibActions)

registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})
