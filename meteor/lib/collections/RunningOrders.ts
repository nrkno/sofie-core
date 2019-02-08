import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { Time, applyClassToDocument, getCurrentTime, registerCollection, normalizeArray, waitForPromiseAll, makePromise } from '../lib'
import { Segments, DBSegment, Segment } from './Segments'
import { SegmentLines, SegmentLine } from './SegmentLines'
import { MOS } from 'tv-automation-sofie-blueprints-integration'
import { FindOptions, MongoSelector, TransformedCollection } from '../typings/meteor'
import { StudioInstallations, StudioInstallation } from './StudioInstallations'
import { SegmentLineItems, SegmentLineItem } from './SegmentLineItems'
import { RunningOrderDataCache } from './RunningOrderDataCache'
import { Meteor } from 'meteor/meteor'
import { SegmentLineAdLibItems } from './SegmentLineAdLibItems'
import { RunningOrderBaselineItems } from './RunningOrderBaselineItems'
import { RunningOrderBaselineAdLibItems } from './RunningOrderBaselineAdLibItems'
import { IBlueprintRunningOrder } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleCompound, getShowStyleCompound, ShowStyleVariants } from './ShowStyleVariants'
import { ShowStyleBase, ShowStyleBases } from './ShowStyleBases'

export enum RunningOrderHoldState {
	NONE = 0,
	PENDING = 1, // During STK
	ACTIVE = 2, // During full, STK is played
	COMPLETE = 3, // During full, full is played
}

export interface RunningOrderImportVersions {
	studioInstallation: number
	showStyleBase: number
	showStyleVariant: number
	blueprint: number

	core: string
}

/** This is a very uncomplete mock-up of the Rundown object */
export interface DBRunningOrder extends IBlueprintRunningOrder {
	_id: string
	/** ID of the object in MOS */
	mosId: string
	studioInstallationId: string
	/** The ShowStyleVariant this RunningOrder uses */
	showStyleVariantId: string
	/** The ShowStyleBase this RunningOrder uses (its the parent of the showStyleVariant) */
	showStyleBaseId: string
	/** the mos device the rundown originates from */
	mosDeviceId: string
	/** Rundown slug - user-presentable name */
	name: string
	created: Time
	modified: Time

	/** Revisions/Versions of various docs that when changed require the user to reimport the RO */
	importVersions: RunningOrderImportVersions

	/** Expected start should be set to the expected time this running order should run on air. Should be set to EditorialStart from IMOSRunningOrder */
	expectedStart?: Time
	/** Expected duration of the running order - should be set to EditorialDuration from IMOSRunningOrder */
	expectedDuration?: number

	metaData?: Array<MOS.IMOSExternalMetaData>
	status?: MOS.IMOSObjectStatus
	airStatus?: MOS.IMOSObjectAirStatus
	// There should be something like a Owner user here somewhere?
	active?: boolean
	/** the id of the Live Segment Line - if empty, no segment line in this rundown is live */
	currentSegmentLineId: string | null
	/** the id of the Next Segment Line - if empty, no segment will follow Live Segment Line */
	nextSegmentLineId: string | null
	/** if nextSegmentLineId was set manually (ie from a user action) */
	nextSegmentLineManual?: boolean
	/** the id of the Previous Segment Line */
	previousSegmentLineId: string | null

	/** Actual time of playback starting */
	startedPlayback?: Time

	/** Is the running order in an unsynced (has been unpublished from ENPS) state? */
	unsynced?: boolean
	/** Timestamp of when RO was unsynced */
	unsyncedTime?: Time

	/** Last sent storyStatus to MOS */
	currentPlayingStoryStatus?: string

	holdState?: RunningOrderHoldState
	/** What the source of the data was */
	dataSource: string
}
export class RunningOrder implements DBRunningOrder {
	public _id: string
	public mosId: string
	public studioInstallationId: string
	public showStyleVariantId: string
	public showStyleBaseId: string
	public mosDeviceId: string
	public name: string
	public created: Time
	public modified: Time
	public importVersions: RunningOrderImportVersions
	public expectedStart?: Time
	public expectedDuration?: number
	public metaData?: Array<MOS.IMOSExternalMetaData>
	public status?: MOS.IMOSObjectStatus
	public airStatus?: MOS.IMOSObjectAirStatus
	public active?: boolean
	public rehearsal?: boolean
	public unsynced?: boolean
	public unsyncedTime?: Time
	public previousSegmentLineId: string | null
	public nextSegmentLineManual?: boolean
	public currentSegmentLineId: string | null
	public nextSegmentLineId: string | null
	public startedPlayback?: Time
	public currentPlayingStoryStatus?: string
	public holdState?: RunningOrderHoldState
	public dataSource: string

	constructor (document: DBRunningOrder) {
		_.each(_.keys(document), (key: keyof DBRunningOrder) => {
			this[key] = document[key]
		})
	}
	getShowStyleCompound (): ShowStyleCompound {

		if (!this.showStyleVariantId) throw new Meteor.Error(500, 'RunningOrder has no show style attached!')
		let ss = getShowStyleCompound(this.showStyleVariantId)
		if (ss) {
			return ss
		} else throw new Meteor.Error(404, `ShowStyle "${this.showStyleVariantId}" not found!`)
	}
	getShowStyleBase (): ShowStyleBase {
		let showStyleBase = ShowStyleBases.findOne(this.showStyleBaseId)
		if (!showStyleBase ) throw new Meteor.Error(404, `ShowStyleBase "${this.showStyleBaseId}" not found!`)
		return showStyleBase
	}
	getStudioInstallation (): StudioInstallation {
		if (!this.studioInstallationId) throw new Meteor.Error(500,'RunningOrder is not in a studioInstallation!')
		let si = StudioInstallations.findOne(this.studioInstallationId)
		if (si) {
			return si
		} else throw new Meteor.Error(404, 'StudioInstallation "' + this.studioInstallationId + '" not found!')
	}
	getSegments (selector?: MongoSelector<DBSegment>, options?: FindOptions) {
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
	getSegmentLines (selector?: MongoSelector<SegmentLine>, options?: FindOptions) {
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
		SegmentLineAdLibItems.remove({ runningOrderId: this._id})
		RunningOrderBaselineItems.remove({ runningOrderId: this._id})
		RunningOrderBaselineAdLibItems.remove({ runningOrderId: this._id})
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
			segmentLine: string,
			elapsed: Time
		}> = []
		_.each(this.getSegmentLines(), (sl: SegmentLine) => {
			_.each(sl.getTimings(), (t) => {

				timings.push({
					time: t.time,
					elapsed: t.elapsed,
					type: t.type,
					segmentLine: sl._id
				})
			})
		})
		return timings
	}
	fetchAllData (): RoData {

		// Do fetches in parallell:
		let ps: [
			Promise<{ segments: Segment[], segmentsMap: any }>,
			Promise<{ segmentLines: SegmentLine[], segmentLinesMap: any } >,
			Promise<SegmentLineItem[]>
		] = [
			makePromise(() => {
				let segments = this.getSegments()
				let segmentsMap = normalizeArray(segments, '_id')
				return { segments, segmentsMap }
			}),
			makePromise(() => {
				let segmentLines = _.map(this.getSegmentLines(), (sl) => {
					// Override member function to use cached data instead:
					sl.getAllSegmentLineItems = () => {
						return _.map(_.filter(segmentLineItems, (sli) => {
							return (
								sli.segmentLineId === sl._id
							)
						}), (sl) => {
							return _.clone(sl)
						})
					}
					return sl
				})
				let segmentLinesMap = normalizeArray(segmentLines, '_id')
				return { segmentLines, segmentLinesMap }
			}),
			makePromise(() => {
				return SegmentLineItems.find({ runningOrderId: this._id }).fetch()
			})
		]
		let r = waitForPromiseAll(ps as any)
		let segments: Segment[] 				= r[0].segments
		let segmentsMap 				 		= r[0].segmentsMap
		let segmentLinesMap 					= r[1].segmentLinesMap
		let segmentLines: SegmentLine[]			= r[1].segmentLines
		let segmentLineItems: SegmentLineItem[] = r[2]

		return {
			runningOrder: this,
			segments,
			segmentsMap,
			segmentLines,
			segmentLinesMap,
			segmentLineItems
		}
	}
}
export interface RoData {
	runningOrder: RunningOrder
	segments: Array<Segment>
	segmentsMap: {[id: string]: Segment}
	segmentLines: Array<SegmentLine>
	segmentLinesMap: {[id: string]: SegmentLine}
	segmentLineItems: Array<SegmentLineItem>
}

// export const RunningOrders = new Mongo.Collection<RunningOrder>('rundowns', {transform: (doc) => applyClassToDocument(RunningOrder, doc) })
export const RunningOrders: TransformedCollection<RunningOrder, DBRunningOrder>
	= new Mongo.Collection<RunningOrder>('rundowns', {transform: (doc) => applyClassToDocument(RunningOrder, doc) })
registerCollection('RunningOrders', RunningOrders)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrders._ensureIndex({
			studioInstallationId: 1,
			active: 1
		})
	}
})
