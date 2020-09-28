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
import { registerIndex } from '../database'

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
	/** If this piece has been insterted during run of rundown (such as adLibs), then this is set to the timestamp it was inserted */
	dynamicallyInserted?: Time

	/** Only set when this pieceInstance is an infinite. It contains info about the infinite */
	infinite?: {
		infinitePieceId: PieceId
		// TODO - more properties?
		/** When the instance was a copy made from hold */
		fromHold?: boolean

		/** Whether this was 'copied' from the previous PartInstance or Part */
		fromPreviousPart: boolean
		/** Whether this was 'copied' from the previous PartInstance via the playhead, rather than from a Part */
		fromPreviousPlayhead?: boolean

		// /** The first partInstance this existed in */
		// firstPartInsanceId: PartInstanceId
		/** The last partInstance this should exist in */
		lastPartInstanceId?: PartInstanceId
	}

	/** The time the system started playback of this part, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: Time
	/** Whether the piece has stopped playback (the most recent time it was played).
	 * This is set from a callback from the playout gateway (milliseconds since epoch)
	 */
	stoppedPlayback?: Time

	/** This is set when the duration needs to be overriden from some user action (milliseconds since start of part) */
	userDuration?: {
		end: number
	}
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

registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
