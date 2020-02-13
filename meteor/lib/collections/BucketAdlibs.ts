import { PieceGeneric, PieceId } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownImportVersions } from './Rundowns'
import { StudioId } from './Studios'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { BucketId } from './Buckets'

export interface BucketAdLib extends IBlueprintAdLibPiece {
	_id: PieceId
	bucketId: BucketId

	studioId: StudioId
	showStyleVariantId: ShowStyleVariantId

	importVersions: RundownImportVersions // TODO - is this good?
}

export const BucketAdLibs: TransformedCollection<BucketAdLib, BucketAdLib> = createMongoCollection<BucketAdLib>('bucketAdlibs')
registerCollection('BucketAdLibs', BucketAdLibs)
// Meteor.startup(() => {
// 	if (Meteor.isServer) {
// 		BucketAdLibs._ensureIndex({
// 			rundownId: 1,
// 			partId: 1,
// 			_rank: 1
// 		})
// 	}
// })
