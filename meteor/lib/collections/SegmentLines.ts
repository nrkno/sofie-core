import { Mongo } from 'meteor/mongo'

/** A "Line" in NRK Lingo. */
export interface SegmentLine {
	_id: string
  /** Position inside the segment */
	_rank: Number,
  /** ID of the source object in MOS */
	mosId: string,
  /** The segment ("Title") this line belongs to */
	segmentId: string
  /** The running order this line belongs to */
	runningOrderId: string
}

export const SegmentLines = new Mongo.Collection<SegmentLine>('segmentLines')
