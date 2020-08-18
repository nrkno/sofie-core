import { Meteor } from 'meteor/meteor'
import { BaseContent, IBlueprintAdLibPiece } from 'tv-automation-sofie-blueprints-integration'
import { registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { PartId } from './Parts'
import { PieceGeneric } from './Pieces'
import { RundownId } from './Rundowns'

export interface AdLibPiece extends PieceGeneric, IBlueprintAdLibPiece {
	/** The object describing the piece in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintAdLibPiece

	// trigger: undefined
	// disabled: false

	/** Rundown this AdLib belongs to */
	rundownId: RundownId

	/** Part this AdLib belongs to */
	partId?: PartId
}

export const AdLibPieces: TransformedCollection<AdLibPiece, AdLibPiece> = createMongoCollection<AdLibPiece>(
	'adLibPieces'
)
registerCollection('AdLibPieces', AdLibPieces)
Meteor.startup(() => {
	if (Meteor.isServer) {
		AdLibPieces._ensureIndex({
			rundownId: 1,
			partId: 1,
			_rank: 1,
		})
	}
})
