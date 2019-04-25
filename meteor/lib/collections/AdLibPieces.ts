import { Mongo } from 'meteor/mongo'
import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'

export interface AdLibPiece extends PieceGeneric, IBlueprintAdLibPiece {
	expectedDuration: number | string

	/** The object describing the item in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintAdLibPiece

	trigger: undefined
	disabled: false
}

export const AdLibPieces: TransformedCollection<AdLibPiece, AdLibPiece>
	= new Mongo.Collection<AdLibPiece>('adLibPieces')
registerCollection('AdLibPieces', AdLibPieces)
Meteor.startup(() => {
	if (Meteor.isServer) {
		AdLibPieces._ensureIndex({
			rundownId: 1,
			partId: 1,
			_rank: 1
		})
	}
})
