import { Mongo } from 'meteor/mongo';

/** A "Title" in ENPS Lingo. */
export interface Segment {
	_id: String,
  /** The rundown this segment belongs to */
  rundownId: String,
  /** User-presentable name for the Title */
	name: String,
  expanded: Boolean
}

export const Segments = new Mongo.Collection<Segment>('segments');
