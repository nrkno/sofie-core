import { TransformedCollection } from '../typings/meteor'
import { registerCollection, literal } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintPieceInstance, Time, IBlueprintResolvedPieceInstance } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { Piece } from './Pieces'
import { PartInstance } from './PartInstances';

export interface PieceInstance extends IBlueprintPieceInstance {
	/** Whether this PieceInstance is a temprorary wrapping of a Piece */
	readonly isTemporary?: boolean

	_id: string
	/** The rundown this piece belongs to */
	rundownId: string
	/** The part instace this piece belongs to */
	partInstanceId: string

	piece: Piece
}

export interface ResolvedPieceInstance extends PieceInstance, IBlueprintResolvedPieceInstance {
	piece: Piece
}

export function WrapPieceToTemporaryInstance (piece: Piece, partInstanceId: string): PieceInstance {
	return literal<PieceInstance>({
		isTemporary: true,
		_id: `${piece._id}_tmp_instance`,
		rundownId: piece.rundownId,
		partInstanceId: partInstanceId,
		piece: piece
	})
}

export function FindPieceInstanceOrWrapToTemporary (partInstances: PieceInstance[], partInstanceId: string, piece: Piece): PieceInstance {
	return partInstances.find(instance => instance.piece._id === piece._id) || WrapPieceToTemporaryInstance(piece, partInstanceId)
}

export function WrapPieceToInstance(piece: Piece, partInstanceId: string): PieceInstance {
	return {
		_id: `${partInstanceId}_${piece._id}`,
		rundownId: piece.rundownId,
		partInstanceId: partInstanceId,
		piece: piece
	}
}

export const PieceInstances: TransformedCollection<PieceInstance, PieceInstance> = createMongoCollection<PieceInstance>('pieceInstances')
registerCollection('PieceInstances', PieceInstances)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PieceInstances._ensureIndex({
			rundownId: 1,
			partInstanceId: 1
		})
	}
})
