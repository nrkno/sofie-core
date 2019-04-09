import { Mongo } from 'meteor/mongo'
import { RunningOrderAPI } from '../api/runningOrder'
import { TimelineTransition } from 'timeline-state-resolver-types'
import { TransformedCollection } from '../typings/meteor'
import { SegmentLineTimings } from './SegmentLines'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintSegmentLineItemGeneric,
	IBlueprintSegmentLineItem,
	SegmentLineItemLifespan,
	Timeline,
	BaseContent,
} from 'tv-automation-sofie-blueprints-integration'

/** A Single item in a "line": script, VT, cameras */
export interface SegmentLineItemGeneric extends IBlueprintSegmentLineItemGeneric {
	// ------------------------------------------------------------------
	_id: string
	/** ID of the source object in MOS */
	externalId: string
	/** The running order this item belongs to */
	runningOrderId: string

	/** Playback availability status */
	status: RunningOrderAPI.LineItemStatusCode
	/** Actual duration of the item, as played-back, in milliseconds. This value will be updated during playback for some types of items. */
	duration?: number
	/** A flag to signal a given SegmentLineItem has been deactivated manually */
	disabled?: boolean
	/** A flag to signal that a given SegmentLineItem should be hidden from the UI */
	hidden?: boolean
	/** A flag to signal that a given SegmentLineItem has no content, and exists only as a marker on the timeline */
	virtual?: boolean
	/** The transition used by this segment line item to transition to and from the item */
	transitions?: {
		/** In transition for the item */
		inTransition?: TimelineTransition
		/** The out transition for the item */
		outTransition?: TimelineTransition
	}
	/** The id of the item this item is a continuation of. If it is a continuation, the inTranstion must not be set, and trigger must be 0 */
	continuesRefId?: string
	/** If this item has been created play-time using an AdLibItem, this should be set to it's source item */
	adLibSourceId?: string
	/** If this item has been insterted during run of RO (such as adLibs). Df set, this won't be affected by updates from MOS */
	dynamicallyInserted?: boolean,
	/** The time the system started playback of this segment line, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** Playout timings, in here we log times when playout happens */
	timings?: SegmentLineTimings
	/** If this item has been inserted by the post-process blueprint step */
	fromPostProcess?: boolean

	isTransition?: boolean
	extendOnHold?: boolean
}

export interface SegmentLineItem extends SegmentLineItemGeneric, IBlueprintSegmentLineItem {
	// -----------------------------------------------------------------------

	segmentLineId: string
	expectedDuration: number | string
	/** This is a backup of the original expectedDuration of the item, so that the normal field can be modified during playback and restored afterwards */
	originalExpectedDuration?: number | string
	/** This is set when an item's duration needs to be overriden */
	durationOverride?: number
	/** This is set when the item is infinite, to deduplicate the contents on the timeline, while allowing out of order */
	infiniteMode?: SegmentLineItemLifespan
	/** This is a backup of the original infiniteMode of the item, so that the normal field can be modified during playback and restored afterwards */
	originalInfiniteMode?: SegmentLineItemLifespan
	/** This is the id of the original segment of an infinite item chain. If it matches the id of itself then it is the first in the chain */
	infiniteId?: string

	/** The object describing the item in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintSegmentLineItem

	/** Whether the sli has stopped playback (the most recent time it was played).
	 * This is set from a callback from the playout gateway
	 */
	stoppedPlayback?: number

	/** This is set when the item isn't infinite, but should overflow it's duration onto the adjacent (not just next) segment line on take */
	overflows?: boolean
}

export const SegmentLineItems: TransformedCollection<SegmentLineItem, SegmentLineItem>
	= new Mongo.Collection<SegmentLineItem>('segmentLineItems')
registerCollection('SegmentLineItems', SegmentLineItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLineItems._ensureIndex({
			runningOrderId: 1,
			segmentLineId: 1
		})
	}
})
