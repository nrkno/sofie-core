import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export interface Bucket {
	_id: string
	name: string
}
export const Buckets: TransformedCollection<Bucket, Bucket> = createMongoCollection<Bucket>('buckets')
registerCollection('Buckets', Buckets)
// Meteor.startup(() => {
// 	if (Meteor.isServer) {
// 		Buckets._ensureIndex({
// 			_rank: 1
// 		})
// 	}
// })
