import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { TransformedCollection, MongoSelector, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { Time, applyClassToDocument, registerCollection, normalizeArray, makePromise, getCurrentTime, asyncCollectionFindFetch, waitForPromise, normalizeArrayFunc, mongoWhere, ProtectedString, unprotectString } from '../lib'
import { RundownHoldState, Rundowns, Rundown, DBRundown, RundownId } from './Rundowns'
import { Studio, Studios, StudioId } from './Studios'
import { Segments, Segment, DBSegment, SegmentId } from './Segments'
import { Parts, Part, DBPart } from './Parts'
import { Pieces, Piece } from './Pieces'
import { TimelinePersistentState } from 'tv-automation-sofie-blueprints-integration'
import { PartInstance, PartInstances, PartInstanceId } from './PartInstances'
import { PieceInstance, PieceInstances } from './PieceInstances'
import { GenericNote, RundownNote, TrackedNote } from '../api/notes'
import { PeripheralDeviceId } from './PeripheralDevices'
import { createMongoCollection } from './lib'

/** A string, identifying a RundownPlaylist */
export type RundownPlaylistId = ProtectedString<'RundownPlaylistId'>

export interface DBRundownPlaylist {
	_id: RundownPlaylistId
	externalId: string
	studioId: StudioId
	peripheralDeviceId: PeripheralDeviceId
	restoredFromSnapshotId?: RundownPlaylistId
	name: string
	created: Time
	modified: Time
	expectedStart?: Time
	expectedDuration?: number
	rehearsal?: boolean
	holdState?: RundownHoldState

	active?: boolean
	/** the id of the Live Part - if empty, no part in this rundown is live */
	currentPartInstanceId: PartInstanceId | null
	/** the id of the Next Part - if empty, no segment will follow Live Part */
	nextPartInstanceId: PartInstanceId | null
	/** The time offset of the next line */
	nextTimeOffset?: number | null
	/** if nextPartId was set manually (ie from a user action) */
	nextPartManual?: boolean
	/** the id of the Previous Part */
	previousPartInstanceId: PartInstanceId | null

	/** Marker indicating if unplayed parts behind the onAir part, should be treated as "still to be played" or "skipped" in terms of timing calculations */
	outOfOrderTiming?: boolean
	/** The id of the Next Segment. If set, the Next point will jump to that segment when moving out of currently playing segment. */
	nextSegmentId?: SegmentId

	/** Actual time of playback starting */
	startedPlayback?: Time
	/** Timestamp for the last time an incorrect part was reported as started */
	lastIncorrectPartPlaybackReported?: Time

	/** Previous state persisted from ShowStyleBlueprint.onTimelineGenerate */
	previousPersistentState?: TimelinePersistentState
}

export interface RundownPlaylistPlayoutData {
	rundownPlaylist: RundownPlaylist,
	/** Ordered array of the Rundowns in a Playlist */
	rundowns: Rundown[],
	rundownsMap: { [key: string]: Rundown },
	/** Ordered array of the Segments in a Playlist */
	segments: Segment[],
	segmentsMap: { [key: string]: Segment},
	/** Ordered array of the Parts in a Playlist */
	parts: Part[],
	partsMap: { [key: string]: Part },
	pieces: Piece[]

	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	previousPartInstance: PartInstance | undefined
	selectedInstancePieces: Array<PieceInstance>
}

export class RundownPlaylist implements DBRundownPlaylist {
	public _id: RundownPlaylistId
	public externalId: string
	public studioId: StudioId
	public peripheralDeviceId: PeripheralDeviceId
	public restoredFromSnapshotId?: RundownPlaylistId
	public name: string
	public created: Time
	public modified: Time
	public startedPlayback?: Time
	public lastIncorrectPartPlaybackReported?: Time
	public expectedStart?: Time
	public expectedDuration?: number
	public rehearsal?: boolean
	public holdState?: RundownHoldState
	public active?: boolean
	public currentPartInstanceId: PartInstanceId | null
	public nextPartInstanceId: PartInstanceId | null
	public nextSegmentId: SegmentId
	public nextTimeOffset?: number | null
	public nextPartManual?: boolean
	public previousPartInstanceId: PartInstanceId | null
	public outOfOrderTiming?: boolean

	public previousPersistentState?: TimelinePersistentState

	constructor (document: DBRundownPlaylist) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	/** Returns all Rundowns in the RundownPlaylist */
	getRundowns (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Rundown[] {
		return Rundowns.find(
			_.extend({
				playlistId: this._id
			}, selector),
			_.extend({
				sort: {
					_rank: 1,
					_id: 1
				}
			}, options)
		).fetch()
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist */
	getRundownIDs (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): RundownId[] {
		return this.getRundowns(selector, _.extend({
			sort: {
				_rank: 1,
				_id: 1
			},
			fields: {
				_rank: 1,
				_id: 1
			}
		}, options)).map(i => i._id)
	}
	getRundownsMap (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): { [key: string]: Rundown } {
		return normalizeArray(this.getRundowns(selector, options), '_id')
	}
	touch () {
		if (!Meteor.isServer) throw new Meteor.Error('The "remove" method is available server-side only (sorry)')
		if (getCurrentTime() - this.modified > 3600 * 1000) {
			const m = getCurrentTime()
			this.modified = m
			RundownPlaylists.update(this._id, { $set: { modified: m } })
		}
	}
	/** Remove this RundownPlaylist and all its contents */
	remove () {
		if (!Meteor.isServer) throw new Meteor.Error('The "remove" method is available server-side only (sorry)')
		const allRundowns = this.getRundowns()
		allRundowns.forEach(i => i.remove())

		RundownPlaylists.remove(this._id)
	}
	/** Return the studio for this RundownPlaylist */
	getStudio (): Studio {
		if (!this.studioId) throw new Meteor.Error(500,'Rundown is not in a studio!')
		let studio = Studios.findOne(this.studioId)
		if (studio) {
			return studio

		} else throw new Meteor.Error(404, 'Studio "' + this.studioId + '" not found!')
	}
	/** Returns all segments in their correct order for this RundownPlaylist */
	getSegments (selector?: MongoSelector<DBRundownPlaylist>, options?: FindOptions): Segment[] {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				_rank: 1,
				playlistId: 1
			}
		})
		const segments = Segments.find(_.extend({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, selector), _.extend({
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}, options)).fetch()
		return RundownPlaylist._sortSegments(segments, rundowns)
	}
	getAllOrderedParts () {
		const { parts } = this.getSegmentsAndPartsSync()
		return parts
	}
	getUnorderedParts (selector?: MongoSelector<DBRundownPlaylist>): Part[] {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				_id: 1,
				_rank: 1,
				name: 1
			}
		})
		const parts = Parts.find(_.extend({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, selector), {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch()
		return parts
	}
	/**
	 * Return ordered lists of all Segments and Parts of the rundowns
	 */
	async getSegmentsAndParts (rundowns0?: DBRundown[]): Promise<{ segments: Segment[], parts: Part[] }> {
		let rundowns = rundowns0
		if (!rundowns) {
			rundowns = this.getRundowns(undefined, {
				fields: {
					_id: 1,
					_rank: 1,
					name: 1
				}
			})
		}
		const rundownIds = rundowns.map(i => i._id)

		const pSegments = asyncCollectionFindFetch(Segments, {
			rundownId: {
				$in: rundownIds
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		})

		const pParts = asyncCollectionFindFetch(Parts, {
			rundownId: {
				$in: rundownIds
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		})

		const segments = RundownPlaylist._sortSegments(await pSegments, rundowns)
		return {
			segments: segments,
			parts: RundownPlaylist._sortPartsInner(await pParts, segments)
		}
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	getSegmentsAndPartsSync (): { segments: Segment[], parts: Part[] } {

		const rundowns = this.getRundowns(undefined, {
			fields: {
				_rank: 1,
				playlistId: 1
			}
		})
		const segments = Segments.find({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch()

		const parts = Parts.find({
			rundownId: {
				$in: rundowns.map(i => i._id)
			}
		}, {
			sort: {
				rundownId: 1,
				_rank: 1
			}
		}).fetch()

		const sortedSegments = RundownPlaylist._sortSegments(segments, rundowns)
		return {
			segments: sortedSegments,
			parts: RundownPlaylist._sortPartsInner(parts, segments)
		}
	}
	getSelectedPartInstances (rundownIds0?: RundownId[]) {
		let rundownIds = rundownIds0
		if (!rundownIds) {
			rundownIds = this.getRundownIDs()
		}

		const ids = _.compact([
			this.currentPartInstanceId,
			this.previousPartInstanceId,
			this.nextPartInstanceId
		])
		const instances = ids.length > 0 ? PartInstances.find({
			rundownId: { $in: rundownIds },
			_id: { $in: ids },
			reset: { $ne: true }
		}).fetch() : []

		return {
			currentPartInstance: instances.find(inst => inst._id === this.currentPartInstanceId),
			nextPartInstance: instances.find(inst => inst._id === this.nextPartInstanceId),
			previousPartInstance: instances.find(inst => inst._id === this.previousPartInstanceId)
		}
	}
	getAllPartInstances (selector?: MongoSelector<PartInstance>, options?: FindOptions) {
		const rundownIds = this.getRundownIDs()

		selector = selector || {}
		options = options || {}
		return PartInstances.find(
			_.extend({
				rundownId: { $in: rundownIds },
			}, selector),
			_.extend({
				sort: { takeCount: 1 }
			}, options)
		).fetch()
	}
	getActivePartInstances (selector?: MongoSelector<PartInstance>, options?: FindOptions) {
		const newSelector = {
			...selector,
			reset: { $ne: true }
		}
		return this.getAllPartInstances(newSelector, options)
	}
	getActivePartInstancesMap (selector?: MongoSelector<PartInstance>, options?: FindOptions) {
		const instances = this.getActivePartInstances(selector, options)
		return normalizeArrayFunc(instances, i => unprotectString(i.part._id))
	}
	fetchAllPlayoutData (): RundownPlaylistPlayoutData {
		const rundowns = Rundowns.find({ playlistId: this._id }, {
			sort: {
				_rank: 1
			}
		}).fetch()
		const rundownIds = rundowns.map(i => i._id)

		const partInstanceIds = _.compact([
			this.currentPartInstanceId,
			this.previousPartInstanceId,
			this.nextPartInstanceId
		])

		const pSegmentsAndParts = this.getSegmentsAndParts(rundowns)
		const pPieces = asyncCollectionFindFetch(Pieces, { rundownId: { $in: rundownIds } })
		const pSelectedInstancePieces = asyncCollectionFindFetch(PieceInstances, {
			rundownId: { $in: rundownIds },
			partInstanceId: { $in: partInstanceIds }
		})
		const pSelectedPartInstances = makePromise(() => this.getSelectedPartInstances(rundownIds))

		// Do fetches in parallell:
		const segmentsAndParts = waitForPromise(pSegmentsAndParts)
		const pieces = waitForPromise(pPieces)
		const selectedPartInstances = waitForPromise(pSelectedPartInstances)
		const selectedInstancePieces = waitForPromise(pSelectedInstancePieces)

		// Force to use preloaded pieces when possible
		_.each(segmentsAndParts.parts, part => {
			part.getAllPieces = () => {
				return _.map(_.filter(pieces, (piece) => {
					return (
						piece.partId === part._id
					)
				}), (part) => {
					return _.clone(part)
				})
			}
		})
		_.each(_.values(selectedPartInstances), partInstance => {
			if (partInstance) {
				partInstance.getAllPieceInstances = () => {
					return _.map(_.filter(selectedInstancePieces, (piece) => {
						return (
							piece.partInstanceId === partInstance._id
						)
					}), (piece) => {
						return _.clone(piece)
					})
				}
			}
		})

		return {
			rundownPlaylist: this,
			rundowns,
			rundownsMap: normalizeArray(rundowns, '_id'),
			segments: segmentsAndParts.segments,
			segmentsMap: normalizeArray(segmentsAndParts.segments, '_id'),
			parts: segmentsAndParts.parts,
			partsMap: normalizeArray(segmentsAndParts.parts, '_id'),
			pieces,
			...selectedPartInstances,
			selectedInstancePieces
		}
	}

	static _sortSegments (segments: Segment[], rundowns: DBRundown[]) {
		const rundownsMap = normalizeArray(rundowns, '_id')
		return segments.sort((a, b) => {
			if (a.rundownId === b.rundownId) {
				return a._rank - b._rank
			} else {
				const rdA = rundownsMap[unprotectString(a.rundownId)]
				const rdB = rundownsMap[unprotectString(b.rundownId)]
				return rdA._rank - rdB._rank
			}
		})
	}
	static _sortParts (parts: Part[], rundowns: DBRundown[], segments: Segment[]) {
		return RundownPlaylist._sortPartsInner(parts, RundownPlaylist._sortSegments(segments, rundowns))
	}
	static _sortPartsInner<P extends DBPart> (parts: P[], sortedSegments: DBSegment[]): P[] {
		const segmentRanks: {[segmentId: string]: number} = {}
		_.each(sortedSegments, (segment, i) => segmentRanks[unprotectString(segment._id)] = i)

		return parts.sort((a, b) => {
			if (a.segmentId === b.segmentId) {
				return a._rank - b._rank
			} else {
				const segA = segmentRanks[unprotectString(a.segmentId)]
				const segB = segmentRanks[unprotectString(b.segmentId)]
				return segA - segB
			}
		})
	}

	getAllStoredNotes (): Array<TrackedNote> {
		const rundownNotes: RundownNote[] = _.flatten(_.compact(this.getRundowns().map(r => r.notes)))

		let notes: Array<TrackedNote> = []
		notes = notes.concat(rundownNotes.map(note => _.extend(note, { rank: 0 })))

		const segments = this.getSegments()
		const parts = this.getUnorderedParts()

		notes = notes.concat(getAllNotesForSegmentAndParts(segments, parts))

		return notes
	}
}

export function getAllNotesForSegmentAndParts(segments: DBSegment[], parts: Part[]): Array<TrackedNote> {
	let notes: Array<TrackedNote> = []

	const segmentNotes = _.object<{ [key: string ]: { notes: TrackedNote[], rank: number } }>(segments.map(segment => [ segment._id, {
		rank: segment._rank,
		notes: segment.notes
	} ]))
	parts.map(part => {
		const newNotes = (part.notes || []).concat(part.getInvalidReasonNotes())
		if (newNotes.length > 0) {
			const segNotes = segmentNotes[unprotectString(part.segmentId)]
			if (segNotes) {
				segNotes.notes.push(...newNotes.map(n => ({
					...n,
					rank: segNotes.rank,
					origin: {
						...n.origin,
						segmentId: (part.segmentId),
						partId: (part._id),
						rundownId: (part.rundownId),
					}
				})))
			}
		}
	})
	notes = notes.concat(_.flatten(_.map(segmentNotes, o => o.notes)))

	return notes
}

export const RundownPlaylists: TransformedCollection<RundownPlaylist, DBRundownPlaylist>
= createMongoCollection<RundownPlaylist>('rundownPlaylists', { transform: (doc) => applyClassToDocument(RundownPlaylist, doc) })
registerCollection('RundownPlaylists', RundownPlaylists)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownPlaylists._ensureIndex({
			studioId: 1,
			active: 1
		})
	}
})
