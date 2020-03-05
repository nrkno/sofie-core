import { RundownId } from '../collections/Rundowns'
import { SegmentId } from '../collections/Segments'
import { PartId } from '../collections/Parts'
import { PieceId } from '../collections/Pieces'

export enum NoteType {
	WARNING = 1,
	ERROR = 2
}
export interface INoteBase {
	type: NoteType
	message: string
}

export interface GenericNote extends INoteBase {
	origin: {
		name: string,
		rundownId?: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
		pieceId?: PieceId
	}
}
export interface RundownNote extends INoteBase {
	origin: {
		name: string,
		rundownId: RundownId,
	}
}
export interface SegmentNote extends RundownNote {
	origin: {
		name: string,
		rundownId: RundownId,
		segmentId: SegmentId,
		// partId: PartId,
		// pieceId?: PieceId
	}
}

export interface PartNote extends SegmentNote {
	origin: {
		name: string,
		rundownId: RundownId,
		segmentId: SegmentId,
		partId: PartId,
		pieceId?: PieceId
	}
}
