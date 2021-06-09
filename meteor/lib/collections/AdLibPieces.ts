import { PieceGeneric } from './Pieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { IBlueprintAdLibPiece } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { PartId } from './Parts'
import { registerIndex } from '../database'

export interface AdLibPiece extends PieceGeneric, IBlueprintAdLibPiece {
	/** Rundown this AdLib belongs to */
	rundownId: RundownId

	/** Part this AdLib belongs to */
	partId?: PartId
}

export const AdLibPieces: TransformedCollection<AdLibPiece, AdLibPiece> =
	createMongoCollection<AdLibPiece>('adLibPieces')
registerCollection('AdLibPieces', AdLibPieces)

registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})
