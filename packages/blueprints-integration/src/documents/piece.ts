import type { IBlueprintPieceGeneric } from './pieceGeneric'

/** Special types of pieces. Some are not always used in all circumstances */
export enum IBlueprintPieceType {
	Normal = 'normal',
	/** ***CAUTION!*** This Piece will only be used, if the Part containing it has the inTransition property set */
	InTransition = 'in-transition',
	/** ***CAUTION!*** This Piece will only be used, if the Part containing it has the outTransition property set */
	OutTransition = 'out-transition',
}

/** A Single item in a "line": script, VT, cameras. Generated by Blueprint */
export interface IBlueprintPiece<TMetadata = unknown> extends IBlueprintPieceGeneric<TMetadata> {
	/** Timeline enabler. When the piece should be active on the timeline. */
	enable: {
		start: number | 'now' // TODO - now will be removed from this eventually, but as it is not an acceptable value 99% of the time, that is not really breaking
		duration?: number
	}

	/** Whether the piece is a real piece, or exists as a marker to stop an infinite piece. If virtual, it does not add any contents to the timeline */
	virtual?: boolean

	/** Whether this piece is a special piece */
	pieceType?: IBlueprintPieceType

	/** Whether this piece should be extended into the next part when HOLD is used */
	extendOnHold?: boolean

	/** Whether the piece affects the output of the Studio or is describing an invisible state within the Studio */
	notInVision?: boolean
}
export interface IBlueprintPieceDB<TMetadata = unknown> extends IBlueprintPiece<TMetadata> {
	_id: string
}
