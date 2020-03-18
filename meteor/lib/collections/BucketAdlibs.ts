import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownImportVersions } from './Rundowns'
import { BucketId } from './Buckets'
import { StudioId } from './Studios'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { AdLibPiece } from './AdLibPieces';

export interface BucketAdLib extends AdLibPiece {
	bucketId: BucketId

	/**
	 * If an AdLib within the Bucket doesn't match the studioId/showStyleVariantId combination
	 * the adLib will be shown as disabled
	 */
	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId
	
	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibs: TransformedCollection<BucketAdLib, BucketAdLib> = createMongoCollection<BucketAdLib>('bucketAdlibs')
registerCollection('BucketAdLibs', BucketAdLibs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		BucketAdLibs._ensureIndex({
			bucketId: 1,
			studioId: 1
		})
	}
})
