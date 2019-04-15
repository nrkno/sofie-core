import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { Time, applyClassToDocument, getCurrentTime, registerCollection, normalizeArray, waitForPromiseAll, makePromise } from '../lib'
import { Segments, DBSegment, Segment } from './Segments'
import { SegmentLines, SegmentLine } from './SegmentLines'
import { FindOptions, MongoSelector, TransformedCollection } from '../typings/meteor'
import { StudioInstallations, StudioInstallation } from './StudioInstallations'
import { Pieces, Piece } from './Pieces'
import { RundownDataCache } from './RundownDataCache'
import { Meteor } from 'meteor/meteor'
import { AdLibPieces } from './AdLibPieces'
import { RundownBaselineItems } from './RundownBaselineItems'
import { RundownBaselineAdLibItems } from './RundownBaselineAdLibItems'
import { IBlueprintRundownDB } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleCompound, getShowStyleCompound } from './ShowStyleVariants'
import { ShowStyleBase, ShowStyleBases } from './ShowStyleBases'
import { RundownNote } from '../api/notes'

export enum RundownHoldState {
	NONE = 0,
	PENDING = 1, // During STK
	ACTIVE = 2, // During full, STK is played
	COMPLETE = 3, // During full, full is played
}

export interface RundownImportVersions {
	studioInstallation: string
	showStyleBase: string
	showStyleVariant: string
	blueprint: string

	core: string
}

/** This is a very uncomplete mock-up of the Rundown object */
export interface DBRundown extends IBlueprintRundownDB {
	/** The id of the StudioInstallation this rundown is in */
	studioInstallationId: string

	/** The ShowStyleBase this Rundown uses (its the parent of the showStyleVariant) */
	showStyleBaseId: string
	/** The peripheral device the rundown originates from */
	peripheralDeviceId: string
	created: Time
	modified: Time

	/** Revisions/Versions of various docs that when changed require the user to reimport the rundown */
	importVersions: RundownImportVersions

	status?: string
	airStatus?: string
	// There should be something like a Owner user here somewhere?
	active?: boolean
	/** the id of the Live Segment Line - if empty, no segment line in this rundown is live */
	currentSegmentLineId: string | null
	/** the id of the Next Segment Line - if empty, no segment will follow Live Segment Line */
	nextSegmentLineId: string | null
	/** The time offset of the next line */
	nextTimeOffset?: number | null
	/** if nextSegmentLineId was set manually (ie from a user action) */
	nextSegmentLineManual?: boolean
	/** the id of the Previous Segment Line */
	previousSegmentLineId: string | null

	/** Actual time of playback starting */
	startedPlayback?: Time

	/** Is the rundown in an unsynced (has been unpublished from ENPS) state? */
	unsynced?: boolean
	/** Timestamp of when rundown was unsynced */
	unsyncedTime?: Time

	/** Last sent storyStatus to MOS */
	currentPlayingStoryStatus?: string

	holdState?: RundownHoldState
	/** What the source of the data was */
	dataSource: string

	/** Holds notes (warnings / errors) thrown by the blueprints during creation, or appended after */
	notes?: Array<RundownNote>
}
export class Rundown implements DBRundown {
	public _id: string
	public externalId: string
	public studioInstallationId: string
	public showStyleVariantId: string
	public showStyleBaseId: string
	public peripheralDeviceId: string
	public name: string
	public created: Time
	public modified: Time
	public importVersions: RundownImportVersions
	public expectedStart?: Time
	public expectedDuration?: number
	public metaData?: { [key: string]: any }
	public status?: string
	public airStatus?: string
	public active?: boolean
	public rehearsal?: boolean
	public unsynced?: boolean
	public unsyncedTime?: Time
	public previousSegmentLineId: string | null
	public nextSegmentLineManual?: boolean
	public currentSegmentLineId: string | null
	public nextSegmentLineId: string | null
	public nextTimeOffset?: number
	public startedPlayback?: Time
	public currentPlayingStoryStatus?: string
	public holdState?: RundownHoldState
	public dataSource: string
	public notes?: Array<RundownNote>

	constructor (document: DBRundown) {
		_.each(_.keys(document), (key: keyof DBRundown) => {
			this[key] = document[key]
		})
	}
	getShowStyleCompound (): ShowStyleCompound {

		if (!this.showStyleVariantId) throw new Meteor.Error(500, 'Rundown has no show style attached!')
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
		if (!this.studioInstallationId) throw new Meteor.Error(500,'Rundown is not in a studioInstallation!')
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
				rundownId: this._id
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
				rundownId: this._id
			}, selector),
			_.extend({
				sort: {_rank: 1}
			}, options)
		).fetch()
	}
	remove () {
		Rundowns.remove(this._id)
		Segments.remove({rundownId: this._id})
		SegmentLines.remove({rundownId: this._id})
		Pieces.remove({ rundownId: this._id})
		AdLibPieces.remove({ rundownId: this._id})
		RundownBaselineItems.remove({ rundownId: this._id})
		RundownBaselineAdLibItems.remove({ rundownId: this._id})
		this.removeCache()
	}
	touch () {
		if (getCurrentTime() - this.modified > 3600 * 1000 ) {
			Rundowns.update(this._id, {$set: {modified: getCurrentTime()}})
		}
	}
	saveCache (cacheId: string, data: any) {
		if (!Meteor.isServer) throw new Meteor.Error('The "saveCache" method is available server-side only (sorry)')
		let id = this._id + '_' + cacheId
		RundownDataCache.upsert(id, {$set: {
			_id: id,
			rundownId: this._id,
			modified: getCurrentTime(),
			data: data
		}})
	}
	removeCache (cacheId?: string) {
		if (!Meteor.isServer) throw new Meteor.Error('The "removeCache" method is available server-side only (sorry)')
		if (cacheId) {
			let id = this._id + '_' + cacheId
			RundownDataCache.remove(id)
		} else {
			RundownDataCache.remove({
				rundownId: this._id
			})

		}
	}
	fetchCache (cacheId: string): any | null {
		if (!Meteor.isServer) throw new Meteor.Error('The "fetchCache" method is available server-side only (sorry)')
		let id = this._id + '_' + cacheId
		let c = RundownDataCache.findOne(id)
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
	fetchAllData (): RundownData {

		// Do fetches in parallell:
		let ps: [
			Promise<{ segments: Segment[], segmentsMap: any }>,
			Promise<{ segmentLines: SegmentLine[], segmentLinesMap: any } >,
			Promise<Piece[]>
		] = [
			makePromise(() => {
				let segments = this.getSegments()
				let segmentsMap = normalizeArray(segments, '_id')
				return { segments, segmentsMap }
			}),
			makePromise(() => {
				let segmentLines = _.map(this.getSegmentLines(), (sl) => {
					// Override member function to use cached data instead:
					sl.getAllPieces = () => {
						return _.map(_.filter(pieces, (piece) => {
							return (
								piece.segmentLineId === sl._id
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
				return Pieces.find({ rundownId: this._id }).fetch()
			})
		]
		let r = waitForPromiseAll(ps as any)
		let segments: Segment[] 				= r[0].segments
		let segmentsMap 				 		= r[0].segmentsMap
		let segmentLinesMap 					= r[1].segmentLinesMap
		let segmentLines: SegmentLine[]			= r[1].segmentLines
		let pieces: Piece[] = r[2]

		return {
			rundown: this,
			segments,
			segmentsMap,
			segmentLines,
			segmentLinesMap,
			pieces
		}
	}
	getNotes (): Array<RundownNote> {
		let notes: Array<RundownNote> = []
		notes = notes.concat(this.notes || [])

		return notes
	}
	appendNote (note: RundownNote): void {
		Rundowns.update(this._id, {$push: {
			notes: note
		}})
	}
}
export interface RundownData {
	rundown: Rundown
	segments: Array<Segment>
	segmentsMap: {[id: string]: Segment}
	segmentLines: Array<SegmentLine>
	segmentLinesMap: {[id: string]: SegmentLine}
	pieces: Array<Piece>
}

// export const Rundowns = new Mongo.Collection<Rundown>('rundowns', {transform: (doc) => applyClassToDocument(Rundown, doc) })
export const Rundowns: TransformedCollection<Rundown, DBRundown>
	= new Mongo.Collection<Rundown>('rundowns', {transform: (doc) => applyClassToDocument(Rundown, doc) })
registerCollection('Rundowns', Rundowns)
Meteor.startup(() => {
	if (Meteor.isServer) {
		Rundowns._ensureIndex({
			studioInstallationId: 1,
			active: 1
		})
	}
})
