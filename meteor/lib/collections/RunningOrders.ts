import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { Time, applyClassToDocument, getCurrentTime, registerCollection } from '../lib'
import { Segments, DBSegment, Segment } from './Segments'
import { SegmentLines, SegmentLine } from './SegmentLines'
import {
	IMOSExternalMetaData,
	IMOSObjectStatus,
	IMOSObjectAirStatus
} from 'mos-connection'
import { FindOptions, Selector, TransformedCollection } from '../typings/meteor'
import { StudioInstallations, StudioInstallation } from './StudioInstallations'
import { SegmentLineItems } from './SegmentLineItems'
import { RunningOrderDataCache } from './RunningOrderDataCache'
import { ShowStyle, ShowStyles } from './ShowStyles'

export enum RunningOrderHoldState {
	NONE = 0,
	PENDING = 1,
	ACTIVE = 2,
	COMPLETE = 3,
}

/** This is a very uncomplete mock-up of the Rundown object */
export interface DBRunningOrder {
	_id: string
	/** ID of the object in MOS */
	mosId: string
	studioInstallationId: string
	showStyleId: string
	/** the mos device the rundown originates from */
	mosDeviceId: string
	/** Rundown slug - user-presentable name */
	name: string
	created: Time
	modified: Time

	/** Expected start should be set to the expected time this running order should run on air. Should be set to EditorialStart from IMOSRunningOrder */
	expectedStart?: Time
	/** Expected duration of the running order - should be set to EditorialDuration from IMOSRunningOrder */
	expectedDuration?: number

	metaData?: Array<IMOSExternalMetaData>
	status?: IMOSObjectStatus
	airStatus?: IMOSObjectAirStatus
	// There should be something like a Owner user here somewhere?
	active?: boolean
	/** the id of the Live Segment Line - if empty, no segment line in this rundown is live */
	currentSegmentLineId: string | null
	/** the id of the Next Segment Line - if empty, no segment will follow Live Segment Line */
	nextSegmentLineId: string | null
	/** the id of the Previous Segment Line */
	previousSegmentLineId: string | null

	/** Actual time of playback starting */
	startedPlayback?: Time

	/** Last sent storyStatus to MOS */
	currentPlayingStoryStatus?: string

	holdState?: RunningOrderHoldState
}
export class RunningOrder implements DBRunningOrder {
	public _id: string
	public mosId: string
	public studioInstallationId: string
	public showStyleId: string
	public mosDeviceId: string
	public name: string
	public created: Time
	public modified: Time
	public expectedStart?: Time
	public expectedDuration?: number
	public metaData?: Array<IMOSExternalMetaData>
	public status?: IMOSObjectStatus
	public airStatus?: IMOSObjectAirStatus
	public active?: boolean
	public rehearsal?: boolean
	public previousSegmentLineId: string | null
	public currentSegmentLineId: string | null
	public nextSegmentLineId: string | null
	public startedPlayback?: Time
	public currentPlayingStoryStatus?: string
	public holdState?: RunningOrderHoldState

	constructor (document: DBRunningOrder) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	getShowStyle (): ShowStyle {
		if (!this.showStyleId) throw new Meteor.Error(500, 'RunningOrder has no show style attached!')
		let ss = ShowStyles.findOne(this.showStyleId)
		if (ss) {
			return ss
		} else throw new Meteor.Error(404, `ShowStyle "${this.showStyleId}" not found!`)
	}
	getStudioInstallation (): StudioInstallation {
		if (!this.studioInstallationId) throw new Meteor.Error(500,'RunningOrder is not in a studioInstallation!')
		let si = StudioInstallations.findOne(this.studioInstallationId)
		if (si) {
			return si
		} else throw new Meteor.Error(404, 'StudioInstallation "' + this.studioInstallationId + '" not found!')
	}
	getSegments (selector?: Selector<DBSegment>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return Segments.find(
			_.extend({
				runningOrderId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	getSegmentLines (selector?: Selector<SegmentLine>, options?: FindOptions) {
		selector = selector || {}
		options = options || {}
		return SegmentLines.find(
			_.extend({
				runningOrderId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	remove () {
		RunningOrders.remove(this._id)
		Segments.remove({runningOrderId: this._id})
		SegmentLines.remove({runningOrderId: this._id})
		SegmentLineItems.remove({ runningOrderId: this._id})
		this.removeCache()
	}
	touch () {
		if (getCurrentTime() - this.modified > 3600 * 1000 ) {
			RunningOrders.update(this._id, {$set: {modified: getCurrentTime()}})
		}
	}
	saveCache (cacheId: string, data: any) {
		if (!Meteor.isServer) throw new Meteor.Error('The "saveCache" method is available server-side only (sorry)')
		let id = this._id + '_' + cacheId
		RunningOrderDataCache.upsert(id, {$set: {
			_id: id,
			roId: this._id,
			modified: getCurrentTime(),
			data: data
		}})
	}
	removeCache (cacheId?: string) {
		if (!Meteor.isServer) throw new Meteor.Error('The "removeCache" method is available server-side only (sorry)')
		if (cacheId) {
			let id = this._id + '_' + cacheId
			RunningOrderDataCache.remove(id)
		} else {
			RunningOrderDataCache.remove({
				roId: this._id
			})

		}
	}
	fetchCache (cacheId: string): any | null {
		if (!Meteor.isServer) throw new Meteor.Error('The "fetchCache" method is available server-side only (sorry)')
		let id = this._id + '_' + cacheId
		let c = RunningOrderDataCache.findOne(id)
		if (c) {
			return c.data
		}
		return null
	}
	getTimings () {
		let timings: Array<{
			time: Time,
			type: string,
			segmentLine: string
		}> = []
		_.each(this.getSegmentLines(), (sl: SegmentLine) => {
			_.each(sl.getTimings(), (t) => {

				timings.push({
					time: t.time,
					type: t.type,
					segmentLine: sl._id
				})
			})
		})
		return timings
	}
}

// export const RunningOrders = new Mongo.Collection<RunningOrder>('rundowns', {transform: (doc) => applyClassToDocument(RunningOrder, doc) })
export const RunningOrders: TransformedCollection<RunningOrder, DBRunningOrder>
	= new Mongo.Collection<RunningOrder>('rundowns', {transform: (doc) => applyClassToDocument(RunningOrder, doc) })
registerCollection('RunningOrders', RunningOrders)
let c = RunningOrders
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrders._ensureIndex({
			studioInstallationId: 1
		})
	}
})
