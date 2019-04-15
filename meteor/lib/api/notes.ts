
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
		segmentLineId?: string,
		segmentLineItemId?: string
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
export interface SegmentLineNote extends GenericNote {
	type: NoteType,
	origin: {
		name: string,
		rundownId: string,
		segmentId?: string,
		segmentLineId?: string,
		segmentLineItemId?: string
	},
	message: string
}
