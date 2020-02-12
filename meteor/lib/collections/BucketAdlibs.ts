import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export interface BucketAdLib extends IBlueprintAdLibPiece {
	_id: string
	bucketId: string
	
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
