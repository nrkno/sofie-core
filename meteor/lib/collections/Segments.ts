import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { applyClassToDocument, Optional, registerCollection } from '../lib'
import { SegmentLines, SegmentLineNote } from './SegmentLines'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus
} from 'mos-connection'
import { RunningOrders } from './RunningOrders'
import { FindOptions, Selector, TransformedCollection } from '../typings/meteor'

/** A "Title" in NRK Lingo / "Stories" in ENPS Lingo. */
export interface DBSegment {
	_id: string
	/** Position inside running order */
	_rank: number
	/** ID of the source object in MOS */
	mosId: string
	/** The running order this segment belongs to */
	runningOrderId: string
	/** User-presentable name (Slug) for the Title */
	name: string
	number: string

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
	expanded?: boolean

	/** Holds notes (warnings / errors) thrown by the templates during creation */
	notes?: Array<SegmentLineNote>
}
export class Segment implements DBSegment {
	public _id: string
	public _rank: number
	public mosId: string
	public runningOrderId: string
	public name: string
	public number: string
	public metaData?: Array<IMOSExternalMetaData>
	public status?: IMOSObjectStatus
	public expanded?: boolean
	public notes?: Array<SegmentLineNote>

	constructor (document: DBSegment) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRunningOrder () {
		return RunningOrders.findOne(this.runningOrderId)
	}
	getSegmentLines (selector?: Selector<DBSegment>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return SegmentLines.find(
			_.extend({
				runningOrderId: this.runningOrderId,
				segmentId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	getNotes (includeSegmentLines?: boolean, runtimeNotes?: boolean) {
		let notes: Array<SegmentLineNote> = []

		if (includeSegmentLines) {
			const lines = this.getSegmentLines()
			_.each(lines, l => {
				notes = notes.concat(l.getNotes(runtimeNotes))
			})
		}

		notes = notes.concat(this.notes || [])
		return notes
	}
}

// export const Segments = new Mongo.Collection<Segment>('segments', {transform: (doc) => applyClassToDocument(Segment, doc) })
export const Segments: TransformedCollection<Segment, DBSegment>
	= new Mongo.Collection<Segment>('segments', {transform: (doc) => applyClassToDocument(Segment, doc) })
registerCollection('Segments', Segments)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Segments._ensureIndex({
			runningOrderId: 1,
		})
	}
})
