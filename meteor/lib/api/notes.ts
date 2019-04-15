
export enum NoteType {
	WARNING = 1,
	ERROR = 2
}
export interface GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId?: string,
		segmentId?: string,
		partId?: string,
		pieceId?: string
	},
	message: string
}
export interface RundownNote extends GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId: string,
	},
	message: string
}
export interface PartNote extends GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId: string,
		segmentId?: string,
		partId?: string,
		pieceId?: string
	},
	message: string
}
