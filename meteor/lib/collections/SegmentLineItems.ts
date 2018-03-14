import { Mongo } from 'meteor/mongo';
import {RundownAPI} from '../../lib/api/rundown';

/** A trigger interface compatible with that of supertimeline */
export interface ITimelineTrigger {
	type: number,
	value: number|string
}

/** A Single item in a "line": script, VT, cameras */
export interface ISegmentLineItem {
  _id: String,
  /** The segment line this item belongs to */
  segmentLineId: String,
  /** The rundown this item belongs to */
	rundownId: String
	/** User-presentable name for the timeline item */
	name: String,
	/** Timeline item trigger. Possibly, most of these will be manually triggered as next, but maybe some will be automatic. */
	trigger: ITimelineTrigger,
	/** Playback availability status */
	status: RundownAPI.LineItemStatusCode,
	/** Source layer the timeline item belongs to */
	sourceLayerId: String
  /** Layer output this segment line item belongs to */
  outputLayerId: String
	/** Expected duration of the item as planned or as estimated by the system (in case of Script layers), in seconds. */
	expectedDuration: Number,
	/** Actual duration of the item, in seconds. This value will be updated during playback for some types of items. */
	duration: Number,
  /** A flag to signal a given SegmentLineItem has been deactivated manually */
  disabled: Boolean,
  /** The object describing the item in detail */
  content: object
}

export const SegmentLineItems = new Mongo.Collection<ISegmentLineItem>('segmentLineItems');
