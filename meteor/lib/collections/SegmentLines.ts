import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'
import { TransformedCollection, FindOptions, Selector } from '../typings/meteor'
import { RunningOrders } from './RunningOrders'
import { SegmentLineItem, SegmentLineItems } from './SegmentLineItems'
import { SegmentLineAdLibItems } from './SegmentLineAdLibItems'
import { Segments } from './Segments'
import { applyClassToDocument } from '../lib'

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
	overlapUntil?: string
	transitionDelay?: string
	/** Should we block a transition at the out of this SegmentLine */
	disableOutTransition?: boolean
	/** If true, the story status (yellow line) will be updated upon next:ing  */
	updateStoryStatus?: boolean

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** The time the system started playback of this segment line, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds */
	duration?: number

	/** The type of the segmentLiene, could be the name of the template that created it */
	typeVariant?: string
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
	public overlapUntil?: string
	public transitionDelay?: string
	public metaData?: Array<IMOSExternalMetaData>
	public status?: IMOSObjectStatus
	public expectedDuration?: number
	public startedPlayback?: number
	public duration?: number
	public disableOutTransition?: boolean
	public updateStoryStatus?: boolean

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
	getSegmentLinesItems (selector?: Selector<SegmentLineItem>, options?: FindOptions) {
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
	getSegmentLinesAdLibItems (selector?: Selector<SegmentLineItem>, options?: FindOptions) {
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
}

export const SegmentLines: TransformedCollection<SegmentLine, DBSegmentLine>
	= new Mongo.Collection<SegmentLine>('segmentLines', {transform: (doc) => applyClassToDocument(SegmentLine, doc) })
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLines._ensureIndex({
			runningOrderId: 1,
		})
	}
})
