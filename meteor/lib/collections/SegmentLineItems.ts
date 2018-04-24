import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../../lib/api/rundown'
import { TriggerType } from 'superfly-timeline'
import { TimelineTransition } from './Timeline'

/** A trigger interface compatible with that of supertimeline */
export interface ITimelineTrigger {
	type: TriggerType
	value: number|string
}

/** A Single item in a "line": script, VT, cameras */
export interface SegmentLineItem {
	_id: string
	/** ID of the source object in MOS */
	mosId: string
	/** The segment line this item belongs to */
	segmentLineId: string
	/** The running order this item belongs to */
	runningOrderId: string
	/** User-presentable name for the timeline item */
	name: string
	/** Timeline item trigger. Possibly, most of these will be manually triggered as next, but maybe some will be automatic. */
	trigger: ITimelineTrigger
	/** Playback availability status */
	status: RundownAPI.LineItemStatusCode
	/** Source layer the timeline item belongs to */
	sourceLayerId: string
  	/** Layer output this segment line item belongs to */
	outputLayerId: string
	/** Expected duration of the item as planned or as estimated by the system (in case of Script layers), in seconds. */
	expectedDuration: number
	/** Actual duration of the item, in seconds. This value will be updated during playback for some types of items. */
	duration?: number
	/** A flag to signal a given SegmentLineItem has been deactivated manually */
	disabled?: boolean
	/** The transition used by this segment line item to transition to and from the item */
	transitions?: {
		/** In transition for the item */
		inTransition?: TimelineTransition
		/** The out transition for the item */
		outTransition?: TimelineTransition
	}
	/** The object describing the item in detail */
	content?: object
	/** The id of the item this item is a continuation of. If it is a continuation, the inTranstion must not be set, and trigger must be 0 */
	continuesRefId?: string
}

export const SegmentLineItems = new Mongo.Collection<SegmentLineItem>('segmentLineItems')
