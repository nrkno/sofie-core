import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedStringProperties, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export interface AdLibPiece extends PieceGeneric, Omit<IBlueprintAdLibPiece, 'partId'> {
	/** The object describing the piece in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintAdLibPiece

	// trigger: undefined
	disabled: false
}
export const AdLibPieces: TransformedCollection<AdLibPiece, AdLibPiece>
	= createMongoCollection<AdLibPiece>('adLibPieces')
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
