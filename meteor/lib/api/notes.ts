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

export interface TrackedNote extends GenericNote {
	rank: number
	origin: {
		name: string,
		rundownId?: RundownId,
		segmentId?: SegmentId,
		partId?: PartId,
		pieceId?: PieceId
	}
}

export interface GenericNote extends INoteBase {
	origin: {
		name: string,
	}
}
export interface RundownNote extends INoteBase {
	origin: {
		name: string,
	}
}
export interface SegmentNote extends RundownNote {
	origin: {
		name: string,
	}
}

export interface PartNote extends SegmentNote {
	origin: {
		name: string,
		pieceId?: PieceId
	}
}
