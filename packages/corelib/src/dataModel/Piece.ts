import {
	IBlueprintPieceGeneric,
	IBlueprintPieceDB,
	IBlueprintPieceType,
} from '@sofie-automation/blueprints-integration'
import { PieceId, RundownId, SegmentId, PartId } from './Ids'

/** A generic list of playback availability statuses for a Piece */
export enum PieceStatusCode {
	// Note: Higher is worse

	/** No status has been determined (yet) */
	UNKNOWN = -1,

	/** No fault with piece, can be played */
	OK = 0,

	/** The source can be played, but some issues have been detected with it. It can be played fine from a technical standpoint, but the user should be notified. */
	SOURCE_HAS_ISSUES = 10,

	/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
	SOURCE_BROKEN = 20,

	/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
	SOURCE_MISSING = 30,

	/** Source not set - the source object is not set to an actual source */
	SOURCE_NOT_SET = 40,
}

/** A Single item in a Part: script, VT, cameras */
export interface PieceGeneric extends IBlueprintPieceGeneric {
	_id: PieceId // TODO - this should be moved to the implementation types

	/** Playback availability status */
	status: PieceStatusCode
	/** A flag to signal that a given Piece has no content, and exists only as a marker on the timeline */
	virtual?: boolean
	/** The id of the piece this piece is a continuation of. If it is a continuation, the inTranstion must not be set, and enable.start must be 0 */
	continuesRefId?: PieceId
}

export interface Piece extends PieceGeneric, Omit<IBlueprintPieceDB, '_id' | 'continuesRefId'> {
	/**
	 * This is the id of the rundown this piece starts playing in.
	 * Currently this is the only rundown the piece could be playing in
	 */
	startRundownId: RundownId
	/**
	 * This is the id of the segment this piece starts playing in.
	 * It is the only segment the piece could be playing in, unless the piece has a lifespan which spans beyond the segment
	 */
	startSegmentId: SegmentId
	/**
	 * This is the id of the part this piece starts playing in.
	 * If the lifespan is WithinPart, it is the only part the piece could be playing in.
	 */
	startPartId: PartId

	/** Whether this piece is a special piece */
	pieceType: IBlueprintPieceType

	/** This is set when the part is invalid and these pieces should be ignored */
	invalid: boolean
}
