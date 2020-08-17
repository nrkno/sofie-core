import { PieceGeneric, RundownPieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedStringProperties, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintAdLibPiece, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { PartId } from './Parts'
import { BucketId } from './Buckets'

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
