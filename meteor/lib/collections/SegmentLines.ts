import { Mongo } from 'meteor/mongo';

/** A "Line" in NRK Lingo. */
export interface SegmentLine {
  _id: String
  /** Position inside the segment */
  _rank: Number,
  /** ID of the source object in MOS */
	mosId: String,
  /** The segment ("Title") this line belongs to */
  segmentId: String
  /** The running order this line belongs to */
  runningOrderId: String
}

export const SegmentLines = new Mongo.Collection<SegmentLine>('segmentLines');
