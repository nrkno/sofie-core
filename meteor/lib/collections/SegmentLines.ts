import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'
import { TransformedCollection, FindOptions, MongoSelector } from '../typings/meteor'
import { RunningOrders } from './RunningOrders'
import { SegmentLineItem, SegmentLineItems } from './SegmentLineItems'
import { SegmentLineAdLibItems } from './SegmentLineAdLibItems'
import { Segments } from './Segments'
import { applyClassToDocument, Time, registerCollection, normalizeArray } from '../lib'
import { RundownAPI } from '../api/rundown'
import { checkSLIContentStatus } from '../mediaObjects'
import { Meteor } from 'meteor/meteor'

/** A "Line" in NRK Lingo. */
export interface DBSegmentLine {
	_id: string
  /** Position inside the segment */
	_rank: number
  /** ID of the source object in MOS */
	mosId: string
  /** The segment ("Title") this line belongs to */
	segmentId: string
  /** The running order this line belongs to */
	runningOrderId: string
	/** The story Slug (like a title, but slimier) */
	slug: string
	/** Should this item should progress to the next automatically */
	autoNext?: boolean
	/** How much to overlap on when doing autonext */
	autoNextOverlap?: number
	/** What point to extend the old sli until when doing a take */
	overlapDuration?: number
	/** What point to delay the new sli contents until during a transition */
	transitionDelay?: string
	/** What point during the transition is it deemed over (so the previous line can be stopped) */
	transitionDuration?: number
	/** Should we block a transition at the out of this SegmentLine */
	disableOutTransition?: boolean
	/** If true, the story status (yellow line) will be updated upon next:ing  */
	updateStoryStatus?: boolean

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** Whether the sl has started playback, reset each time setAsNext is used */
	startedPlayback?: boolean

	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds */
	duration?: number

	/** The type of the segmentLiene, could be the name of the template that created it */
	typeVariant?: string
	/** The subtype fo the segmentLine */
	subTypeVariant?: string

	/** Playout timings, in here we log times when playout happens */
	timings?: SegmentLineTimings

	/** Whether this segment line supports being used in HOLD */
	holdMode?: SegmentLineHoldMode

	/** Holds notes (warnings / errors) thrown by the templates during creation */
	notes?: Array<SegmentLineNote>
	/** if the segmentLine is inserted after another (for adlibbing) */
	afterSegmentLine?: string
	/** if the segmentLine was dunamically inserted (adlib) */
	dynamicallyInserted?: boolean
}
export interface SegmentLineTimings {
	/** Point in time the SegmentLine was taken, (ie the time of the user action) */
	take: Array<Time>,
	/** Point in time the "take" action has finished executing */
	takeDone: Array<Time>,
	/** Point in time the SegmentLine started playing (ie the time of the playout) */
	startedPlayback: Array<Time>,
	/** Point in time the SegmentLine stopped playing (ie the time of the user action) */
	takeOut: Array<Time>,
	/** Point in time the SegmentLine stopped playing (ie the time of the playout) */
	stoppedPlayback: Array<Time>,
	/** Point in time the SegmentLine was set as Next (ie the time of the user action) */
	next: Array<Time>
}

export enum SegmentLineHoldMode {
	NONE = 0,
	FROM = 1,
	TO = 2,
}

export enum SegmentLineNoteType {
	WARNING = 1,
	ERROR = 2
}
export interface SegmentLineNote {
	type: SegmentLineNoteType,
	origin: {
		name: string,
		roId?: string,
		segmentId?: string,
		segmentLineId?: string,
		segmentLineItemId?: string,
	},
	message: string

}

export class SegmentLine implements DBSegmentLine {
	public _id: string
	public _rank: number
	public mosId: string
	public segmentId: string
	public runningOrderId: string
	public slug: string
	public autoNext?: boolean
	public autoNextOverlap?: number
	public overlapDuration?: number
	public transitionDelay?: string
	public transitionDuration?: number
	public metaData?: Array<IMOSExternalMetaData>
	public status?: IMOSObjectStatus
	public expectedDuration?: number
	public startedPlayback?: boolean
	public duration?: number
	public disableOutTransition?: boolean
	public updateStoryStatus?: boolean
	public timings?: SegmentLineTimings
	public holdMode?: SegmentLineHoldMode
	public notes?: Array<SegmentLineNote>
	public afterSegmentLine?: string

	constructor (document: DBSegmentLine) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRunningOrder () {
		return RunningOrders.findOne(this.runningOrderId)
	}
	getSegment () {
		return Segments.findOne(this.segmentId)
	}
	getSegmentLinesItems (selector?: MongoSelector<SegmentLineItem>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return SegmentLineItems.find(
			_.extend({
				runningOrderId: this.runningOrderId,
				segmentLineId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	getSegmentLinesAdLibItems (selector?: MongoSelector<SegmentLineItem>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return SegmentLineAdLibItems.find(
			_.extend({
				runningOrderId: this.runningOrderId,
				segmentLineId: this._id
			}, selector),
			_.extend({
				sort: { _rank: 1 }
			}, options)
		).fetch()
	}
	getTimings () {
		// return a chronological list of timing events
		let events: Array<{time: Time, type: string, elapsed: Time}> = []
		_.each(['take', 'takeDone', 'startedPlayback', 'takeOut', 'stoppedPlayback', 'next'], (key) => {
			if (this.timings) {
				_.each(this.timings[key], (t: Time) => {
					events.push({
						time: t,
						type: key,
						elapsed: 0
					})
				})
			}
		})
		let prevEv: any = null
		return _.map(
			_.sortBy(events, e => e.time),
			(ev) => {
				if (prevEv) {
					ev.elapsed = ev.time - prevEv.time
				}
				prevEv = ev
				return ev
			}
		)

	}
	getNotes (runtimeNotes?: boolean) {
		let notes: Array<SegmentLineNote> = []
		notes = notes.concat(this.notes || [])

		/* if (runtimeNotes) {
			const items = this.getSegmentLinesItems()
			const ro = this.getRunningOrder()
			const si = ro && ro.getStudioInstallation()
			const slLookup = si && normalizeArray(si.sourceLayers, '_id')
			_.each(items, (item) => {
				// TODO: check statuses (like media availability) here

				if (slLookup && item.sourceLayerId && slLookup[item.sourceLayerId]) {
					const sl = slLookup[item.sourceLayerId]
					const st = checkSLIContentStatus(item, sl)
					if (st.status === RundownAPI.LineItemStatusCode.SOURCE_MISSING || st.status === RundownAPI.LineItemStatusCode.SOURCE_BROKEN) {
						notes.push({
							type: SegmentLineNoteType.ERROR,
							origin: {
								name: 'Media Check',
								segmentLineId: this._id,
								segmentLineItemId: item._id
							},
							message: st.message || ''
						})
					}
				}
			})
		} */
		return notes
	}
	getLastStartedPlayback () {
		if (!this.timings) return undefined

		if (!this.timings.startedPlayback || this.timings.startedPlayback.length === 0) return undefined

		return this.timings.startedPlayback[this.timings.startedPlayback.length - 1]
	}
}

export const SegmentLines: TransformedCollection<SegmentLine, DBSegmentLine>
	= new Mongo.Collection<SegmentLine>('segmentLines', {transform: (doc) => applyClassToDocument(SegmentLine, doc) })
registerCollection('SegmentLines', SegmentLines)
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLines._ensureIndex({
			runningOrderId: 1,
			segmentId: 1,
			_rank: 1
		})
		SegmentLines._ensureIndex({
			runningOrderId: 1,
			_rank: 1
		})
	}
})
