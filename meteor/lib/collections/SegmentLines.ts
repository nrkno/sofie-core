import { Mongo } from 'meteor/mongo';

/** A "Line" in ENPS Lingo. */
export interface SegmentLine {
  _id: String,
  /** The segment ("Title") this line belongs to */
  segmentId: String
  /** The rundown this line belongs to */
  rundownId: String
}

export const SegmentLines = new Mongo.Collection<SegmentLine>('segmentLines');
