import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection, FindOptions, MongoSelector } from '../typings/meteor'
import { Rundowns } from './Rundowns'
import { SegmentLineItem, SegmentLineItems } from './SegmentLineItems'
import { AdLibPieces } from './AdLibPieces'
import { Segments } from './Segments'
import { applyClassToDocument, Time, registerCollection, normalizeArray } from '../lib'
import { RundownAPI } from '../api/rundown'
import { checkSLIContentStatus } from '../mediaObjects'
import { Meteor } from 'meteor/meteor'
import {
	IBlueprintSegmentLineDB,
	SegmentLineHoldMode,
	BlueprintRuntimeArguments,
	IBlueprintSegmentLineDBTimings,
} from 'tv-automation-sofie-blueprints-integration'
import { SegmentLineNote, NoteType } from '../api/notes'

/** A "Line" in NRK Lingo. */
export interface DBSegmentLine extends IBlueprintSegmentLineDB {
	/** Position inside the segment */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: string

	status?: string

	/** Whether the sl has started playback (the most recent time it was played).
	 * This is reset each time setAsNext is used.
	 * This is set from a callback from the playout gateway
	 */
	startedPlayback?: boolean
	/** Whether the sl has stopped playback (the most recent time it was played & stopped).
	 * This is set from a callback from the playout gateway
	 */
	stoppedPlayback?: boolean

	/** The time the system played back this segment line, null if not yet finished playing, in milliseconds.
	 * This is set when Take:ing the next segmentLine
	 */
	duration?: number

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<SegmentLineNote>
	/** if the segmentLine is inserted after another (for adlibbing) */
	afterSegmentLine?: string
	/** if the segmentLine was dunamically inserted (adlib) */
	dynamicallyInserted?: boolean

	/** Runtime blueprint arguments allows Sofie-side data to be injected into the blueprint for an SL */
	runtimeArguments?: BlueprintRuntimeArguments
	/** An SL should be marked as `dirty` if the SL blueprint has been injected with runtimeArguments */
	dirty?: boolean
}
export interface SegmentLineTimings extends IBlueprintSegmentLineDBTimings {
	// TODO: remove these, as they are duplicates with IBlueprintSegmentLineDBTimings

	/** Point in time the SegmentLine stopped playing (ie the time of the playout) */
	stoppedPlayback: Array<Time>,
	/** Point in time the SegmentLine was set as Next (ie the time of the user action) */
	next: Array<Time>,
	/** The playback offset that was set for the last take */
	playOffset: Array<Time>
}

export class SegmentLine implements DBSegmentLine {
	public _id: string
	public _rank: number
	public title: string
	public externalId: string
	public segmentId: string
	public rundownId: string
	public invalid: boolean
	public autoNext?: boolean
	public autoNextOverlap?: number
	public prerollDuration?: number
	public transitionPrerollDuration?: number | null
	public transitionKeepaliveDuration?: number | null
	public transitionDuration?: number | null
	public metaData?: { [key: string]: any }
	public status?: string
	public expectedDuration?: number
	public displayDuration?: number
	public displayDurationGroup?: string
	public startedPlayback?: boolean
	public stoppedPlayback?: boolean
	public duration?: number
	public disableOutTransition?: boolean
	public updateStoryStatus?: boolean
	public timings?: SegmentLineTimings
	public holdMode?: SegmentLineHoldMode
	public notes?: Array<SegmentLineNote>
	public afterSegmentLine?: string
	public dirty?: boolean

	public runtimeArguments?: BlueprintRuntimeArguments
	public typeVariant: string

	public classes?: Array<string>
	public classesForNext?: Array<string>

	constructor (document: DBSegmentLine) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getRundown () {
		return Rundowns.findOne(this.rundownId)
	}
	getSegment () {
		return Segments.findOne(this.segmentId)
	}
	getSegmentLinesItems (selector?: MongoSelector<SegmentLineItem>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return SegmentLineItems.find(
			_.extend({
				rundownId: this.rundownId,
				segmentLineId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	getAllSegmentLineItems () {
		return this.getSegmentLinesItems()
	}

	getSegmentLinesAdLibItems (selector?: MongoSelector<SegmentLineItem>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return AdLibPieces.find(
			_.extend({
				rundownId: this.rundownId,
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
	getNotes (runtimeNotes?: boolean): Array<SegmentLineNote> {
		let notes: Array<SegmentLineNote> = []
		notes = notes.concat(this.notes || [])

		if (runtimeNotes) {
			const items = this.getSegmentLinesItems()
			const rundown = this.getRundown()
			const si = rundown && rundown.getStudioInstallation()
			const showStyleBase = rundown && rundown.getShowStyleBase()
			const slLookup = showStyleBase && normalizeArray(showStyleBase.sourceLayers, '_id')
			_.each(items, (item) => {
				// TODO: check statuses (like media availability) here

				if (slLookup && item.sourceLayerId && slLookup[item.sourceLayerId]) {
					const sl = slLookup[item.sourceLayerId]
					const st = checkSLIContentStatus(item, sl, si ? si.config : [])
					if (st.status === RundownAPI.LineItemStatusCode.SOURCE_MISSING || st.status === RundownAPI.LineItemStatusCode.SOURCE_BROKEN) {
						notes.push({
							type: NoteType.WARNING,
							origin: {
								name: 'Media Check',
								rundownId: this.rundownId,
								segmentId: this.segmentId,
								segmentLineId: this._id,
								segmentLineItemId: item._id
							},
							message: st.message || ''
						})
					}
				}
			})
		}
		return notes
	}
	getLastStartedPlayback () {
		if (!this.timings) return undefined

		if (!this.timings.startedPlayback || this.timings.startedPlayback.length === 0) return undefined

		return this.timings.startedPlayback[this.timings.startedPlayback.length - 1]
	}
	getLastPlayOffset () {
		if (!this.timings) return undefined

		if (!this.timings.playOffset || this.timings.playOffset.length === 0) return undefined

		return this.timings.playOffset[this.timings.playOffset.length - 1]
	}
}

export const SegmentLines: TransformedCollection<SegmentLine, DBSegmentLine>
	= new Mongo.Collection<SegmentLine>('segmentLines', {transform: (doc) => applyClassToDocument(SegmentLine, doc) })
registerCollection('SegmentLines', SegmentLines)
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLines._ensureIndex({
			rundownId: 1,
			segmentId: 1,
			_rank: 1
		})
		SegmentLines._ensureIndex({
			rundownId: 1,
			_rank: 1
		})
	}
})
