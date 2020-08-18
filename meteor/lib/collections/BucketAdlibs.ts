import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece } from 'tv-automation-sofie-blueprints-integration'
import { registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { BucketId } from './Buckets'
import { createMongoCollection } from './lib'
import { PieceId } from './Pieces'
import { RundownImportVersions } from './Rundowns'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { StudioId } from './Studios'

export interface BucketAdLib extends IBlueprintAdLibPiece {
	_id: PieceId
	bucketId: BucketId

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibs: TransformedCollection<BucketAdLib, BucketAdLib> = createMongoCollection<BucketAdLib>(
	'bucketAdlibs'
)
registerCollection('BucketAdLibs', BucketAdLibs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		BucketAdLibs._ensureIndex({
			bucketId: 1,
			studioId: 1,
		})
	}
})
