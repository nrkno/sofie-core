import { TransformedCollection } from '../typings/meteor'
import {
	registerCollection,
	literal,
	ProtectedString,
	ProtectedStringProperties,
	protectString,
	Omit,
	omit,
} from '../lib'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintPieceInstance,
	Time,
	IBlueprintResolvedPieceInstance,
} from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { Piece, PieceId } from './Pieces'
import { PartInstance, PartInstanceId } from './PartInstances'
import { RundownId } from './Rundowns'

/** A string, identifying a PieceInstance */
export type PieceInstanceId = ProtectedString<'PieceInstanceId'>
export function unprotectPieceInstance(pieceInstance: PieceInstance): IBlueprintPieceInstance
export function unprotectPieceInstance(pieceInstance: PieceInstance | undefined): IBlueprintPieceInstance | undefined
export function unprotectPieceInstance(pieceInstance: PieceInstance | undefined): IBlueprintPieceInstance | undefined {
	return pieceInstance as any
}

export type PieceInstancePiece = Omit<Piece, 'startRundownId' | 'startSegmentId'>

export interface PieceInstance extends ProtectedStringProperties<Omit<IBlueprintPieceInstance, 'piece'>, '_id'> {
	/** Whether this PieceInstance is a temprorary wrapping of a Piece */
	readonly isTemporary?: boolean

	/** Whether this instance has been finished with and reset (to restore the original piece as the primary version) */
	reset?: boolean

	_id: PieceInstanceId
	/** The rundown this piece belongs to */
	rundownId: RundownId
	/** The part instace this piece belongs to */
	partInstanceId: PartInstanceId

	piece: PieceInstancePiece

	/** A flag to signal a given Piece has been deactivated manually */
	disabled?: boolean
	/** A flag to signal that a given Piece should be hidden from the UI */
	hidden?: boolean

	/** If this piece has been created play-time using an AdLibPiece, this should be set to it's source piece */
	adLibSourceId?: PieceId
	/** If this piece has been insterted during run of rundown (such as adLibs). Df set, this won't be affected by updates from MOS */
	dynamicallyInserted?: boolean

	/** Only set when this pieceInstance is an infinite. It contains info about the infinite */
	infinite?: {
		infinitePieceId: PieceId
		// lifespan: PieceLifespan // In case the original piece gets destroyed/mutated? // TODO - is this wanted?
		// TODO - more properties?
		/** When the instance was a copy made from hold */
		fromHold?: boolean

		/** Whether this was 'copied' from the previous PartInstance, rather than from a Part */
		fromPrevious?: boolean

		// /** The first partInstance this existed in */
		// firstPartInsanceId: PartInstanceId
		/** The last partInstance this should exist in */
		lastPartInstanceId?: PartInstanceId
	}

	/** This is set when the duration needs to be overriden from some user action */
	userDuration?: {
		end: number
	}

	/** [timestamp) After this time, the piece has definitely ended and its content can be omitted from the timeline */
	definitelyEnded?: number
}

export interface ResolvedPieceInstance extends PieceInstance, Omit<IBlueprintResolvedPieceInstance, '_id' | 'piece'> {
	piece: PieceInstancePiece
}

export function omitPiecePropertiesForInstance(piece: Piece): PieceInstancePiece {
	return omit(piece, 'startRundownId', 'startSegmentId')
}

export function wrapPieceToTemporaryInstance(piece: Piece, partInstanceId: PartInstanceId): PieceInstance {
	return literal<PieceInstance>({
		isTemporary: true,
		_id: protectString(`${piece._id}_tmp_instance`),
		rundownId: piece.startRundownId,
		partInstanceId: partInstanceId,
		piece: omitPiecePropertiesForInstance(piece),
	})
}

export function rewrapPieceToInstance(
	piece: PieceInstancePiece,
	rundownId: RundownId,
	partInstanceId: PartInstanceId,
	isTemporary?: boolean
): PieceInstance {
	return {
		isTemporary,
		_id: protectString(`${partInstanceId}_${piece._id}`),
		rundownId: rundownId,
		partInstanceId: partInstanceId,
		piece: piece,
	}
}

export function wrapPieceToInstance(piece: Piece, partInstanceId: PartInstanceId): PieceInstance {
	return {
		_id: protectString(`${partInstanceId}_${piece._id}`),
		rundownId: piece.startRundownId,
		partInstanceId: partInstanceId,
		piece: omitPiecePropertiesForInstance(piece),
	}
}

export const PieceInstances: TransformedCollection<PieceInstance, PieceInstance> = createMongoCollection<PieceInstance>(
	'pieceInstances'
)
registerCollection('PieceInstances', PieceInstances)
Meteor.startup(() => {
	if (Meteor.isServer) {
		PieceInstances._ensureIndex({
			rundownId: 1,
			partInstanceId: 1,
		})
	}
})
