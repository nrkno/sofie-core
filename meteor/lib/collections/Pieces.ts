import { RundownAPI } from '../api/rundown'
import { TransformedCollection } from '../typings/meteor'
import { PartId } from './Parts'
import { registerCollection, ProtectedString, Omit } from '../lib'
import { IBlueprintPieceGeneric, IBlueprintPieceDB, BaseContent } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'
import { registerIndex } from '../database'

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
}

/** A Single item in a Part: script, VT, cameras */
export interface RundownPieceGeneric extends PieceGeneric {
	// /** The rundown this piece belongs to */
	// rundownId: RundownId
	// /** The Part this piece belongs to */
	// partId?: PartId
}

export interface Piece extends RundownPieceGeneric, Omit<IBlueprintPieceDB, '_id' | 'continuesRefId'> {
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

	/** This is set when the part is invalid and these pieces should be ignored */
	invalid: boolean

	/** The object describing the piece in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintPiece
}

export const Pieces: TransformedCollection<Piece, Piece> = createMongoCollection<Piece>('pieces')
registerCollection('Pieces', Pieces)

registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})
