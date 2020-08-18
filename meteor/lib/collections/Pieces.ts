import { RundownAPI } from '../api/rundown'
import { TransformedCollection } from '../typings/meteor'
import { PartTimings, PartId } from './Parts'
import { registerCollection, ProtectedString, ProtectedStringProperties, Omit } from '../lib'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintPieceGeneric,
	IBlueprintPieceDB,
	PieceLifespan,
	BaseContent,
	Timeline,
} from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'

/** A string, identifying a Piece */
export type PieceId = ProtectedString<'PieceId'>

/** A Single item in a Part: script, VT, cameras */
export interface PieceGeneric extends IBlueprintPieceGeneric {
	_id: PieceId // TODO - this should be moved to the implementation types

	/** Playback availability status */
	status: RundownAPI.PieceStatusCode
	// /** A flag to signal a given Piece has been deactivated manually */
	// disabled?: boolean
	// /** A flag to signal that a given Piece should be hidden from the UI */
	// hidden?: boolean
	/** A flag to signal that a given Piece has no content, and exists only as a marker on the timeline */
	virtual?: boolean
	/** The id of the piece this piece is a continuation of. If it is a continuation, the inTranstion must not be set, and enable.start must be 0 */
	continuesRefId?: PieceId
	// /** If this piece has been created play-time using an AdLibPiece, this should be set to it's source piece */
	// adLibSourceId?: PieceId
	// /** If this piece has been insterted during run of rundown (such as adLibs). Df set, this won't be affected by updates from MOS */
	// dynamicallyInserted?: boolean
	/** The time the system started playback of this part, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** Playout timings, in here we log times when playout happens */
	timings?: PartTimings
	// /** Actual duration of the piece, as played-back, in milliseconds. This value will be updated during playback for some types of pieces. */
	// playoutDuration?: number

	isTransition?: boolean
	extendOnHold?: boolean
}

/** A Single item in a Part: script, VT, cameras */
export interface RundownPieceGeneric extends PieceGeneric {
	// /** The rundown this piece belongs to */
	// rundownId: RundownId
	// /** The Part this piece belongs to */
	// partId?: PartId
}

export interface Piece extends RundownPieceGeneric, Omit<IBlueprintPieceDB, '_id' | 'continuesRefId' | 'infiniteId'> {
	startRundownId: RundownId
	startSegmentId: SegmentId
	startPartId: PartId

	/** This is set when the part is invalid and these pieces should be ignored */
	invalid: boolean

	// /** This is set when an piece's duration needs to be overriden */
	// userDuration?: {
	// 	duration?: number
	// 	end?: string
	// }

	// /** This is set when the piece is infinite, to deduplicate the contents on the timeline, while allowing out of order */
	// infiniteMode?: PieceLifespan
	// /** [timestamp) After this time, the piece has definitely ended and its content can be omitted from the timeline */
	// definitelyEnded?: number
	// /** This is a backup of the original infiniteMode of the piece, so that the normal field can be modified during playback and restored afterwards */
	// originalInfiniteMode?: PieceLifespan
	// /** This is the id of the original segment of an infinite piece chain. If it matches the id of itself then it is the first in the chain */
	// infiniteId?: PieceId

	/** The object describing the piece in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintPiece

	/** Whether the piece has stopped playback (the most recent time it was played).
	 * This is set from a callback from the playout gateway
	 */
	stoppedPlayback?: number

	/** This is set when the piece isn't infinite, but should overflow it's duration onto the adjacent (not just next) part on take */
	overflows?: boolean
}

export const Pieces: TransformedCollection<Piece, Piece> = createMongoCollection<Piece>('pieces')
registerCollection('Pieces', Pieces)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Pieces._ensureIndex({
			startRundownId: 1,
			startSegmentId: 1,
			startPartId: 1,
		})
	}
})
