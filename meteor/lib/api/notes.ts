import { RundownId } from '../collections/Rundowns'
import { SegmentId } from '../collections/Segments';
import { PartId } from '../collections/Parts';
import { PieceId } from '../collections/Pieces';

export enum NoteType {
	WARNING = 1,
	ERROR = 2
}
export interface GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId?: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
		pieceId?: PieceId
	},
	message: string
}
export interface RundownNote extends GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId: RundownId,
	},
	message: string
}
export interface PartNote extends GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
		pieceId?: PieceId
	},
	message: string
}
