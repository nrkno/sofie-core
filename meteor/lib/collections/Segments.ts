import { Mongo } from 'meteor/mongo'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface Segment {
	_id: string,
	/** Position inside running order */
	_rank: Number,
	/** ID of the source object in MOS */
	mosId: string,
  /** The running order this segment belongs to */
	runningOrderId: string,
  /** User-presentable name for the Title */
	name: string,
	expanded: Boolean
}

export const Segments = new Mongo.Collection<Segment>('segments')
