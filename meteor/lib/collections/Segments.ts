import { Mongo } from 'meteor/mongo'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface Segment {
	_id: String,
	/** Position inside running order */
	_rank: Number,
	/** ID of the source object in MOS */
	mosId: String,
  /** The running order this segment belongs to */
	runningOrderId: String,
  /** User-presentable name for the Title */
	name: String,
	expanded: Boolean
}

export const Segments = new Mongo.Collection<Segment>('segments')
