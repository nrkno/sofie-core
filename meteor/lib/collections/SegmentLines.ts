import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'
import { TransformedCollection, FindOptions, Selector } from './typings'
import { RunningOrders } from './RunningOrders'
import { SegmentLineItem, SegmentLineItems } from './SegmentLineItems'
import { SegmentLineAdLibItem, SegmentLineAdLibItems } from './SegmentLineAdLibItems'
import { Segment, Segments } from './Segments'
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
	/** Should this item be taken live automatically */
	autoNext?: boolean

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** The time the system started playback of this segment line, null if not yet played back (milliseconds since epoch) */
	startedPlayback?: number
	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds */
	duration?: number
}
export class SegmentLine implements DBSegmentLine {
	public _id: string
	public _rank: number
	public mosId: string
	public segmentId: string
	public runningOrderId: string
	public slug: string
	public autoNext?: boolean
	public metaData?: Array<IMOSExternalMetaData>
	public status?: IMOSObjectStatus
	public expectedDuration?: number
	public startedPlayback?: number
	public duration?: number

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
