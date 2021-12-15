import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { MongoQuery, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { Time, registerCollection, normalizeArray, normalizeArrayFunc, ProtectedString, unprotectString } from '../lib'
import { RundownHoldState, Rundowns, Rundown, RundownId, DBRundown } from './Rundowns'
import { Studio, Studios, StudioId } from './Studios'
import { Segments, Segment, DBSegment, SegmentId } from './Segments'
import { Parts, Part, DBPart, PartId } from './Parts'
import { RundownPlaylistTiming, TimelinePersistentState } from '@sofie-automation/blueprints-integration'
import { PartInstance, PartInstances, PartInstanceId } from './PartInstances'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'
import { registerIndex } from '../database'
import { PieceInstanceInfiniteId } from './PieceInstances'
import { ReadonlyDeep } from 'type-fest'

/** A string, identifying a RundownPlaylist */
export type RundownPlaylistId = ProtectedString<'RundownPlaylistId'>
/** A string, identifying an activation of a playlist */
export type ActiveInstanceId = ProtectedString<'ActiveInstanceId'>
/** A string, identifying an activation of a playlist */
export type RundownPlaylistActivationId = ProtectedString<'RundownPlaylistActivationId'>

/** Details of an ab-session requested by the blueprints in onTimelineGenerate */
export interface ABSessionInfo {
	/** The unique id of the session. */
	id: string
	/** The name of the session from the blueprints */
	name: string
	/** Set if the session is being by lookahead for a future part */
	lookaheadForPartId?: PartId
	/** Set if the session is being used by an infinite PieceInstance */
	infiniteInstanceId?: PieceInstanceInfiniteId
	/** Set to the PartInstances this session is used by, if not just used for lookahead */
	partInstanceIds?: Array<PartInstanceId>
}

export interface RundownPlaylist {
	_id: RundownPlaylistId
	/** External ID (source) of the playlist */
	externalId: string
	/** ID of the organization that owns the playlist */
	organizationId?: OrganizationId | null
	/** Studio that this playlist is assigned to */
	studioId: StudioId

	restoredFromSnapshotId?: RundownPlaylistId

	/** A name to be displayed to the user */
	name: string
	/** Created timestamp */
	created: Time
	/** Last modified timestamp */
	modified: Time
	/** Rundown timing information */
	timing: RundownPlaylistTiming
	/** Is the playlist in rehearsal mode (can be used, when active: true) */
	rehearsal?: boolean
	/** Playout hold state */
	holdState?: RundownHoldState
	/** Truthy when the playlist is currently active in the studio. This is regenerated upon each activation/reset. */
	activationId?: RundownPlaylistActivationId
	/** Should the playlist loop at the end */
	loop?: boolean
	/** Marker indicating if unplayed parts behind the onAir part, should be treated as "still to be played" or "skipped" in terms of timing calculations */
	outOfOrderTiming?: boolean
	/** Should time-of-day clocks be used instead of countdowns by default */
	timeOfDayCountdowns?: boolean

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

	/** The id of the Next Segment. If set, the Next point will jump to that segment when moving out of currently playing segment. */
	nextSegmentId?: SegmentId

	/** Actual time of playback starting */
	startedPlayback?: Time
	/** Timestamp for the last time an incorrect part was reported as started */
	lastIncorrectPartPlaybackReported?: Time
	/** Actual time of each rundown starting playback */
	rundownsStartedPlayback?: Record<string, Time>

	/** If the _rank of rundowns in this playlist has ben set manually by a user in Sofie */
	rundownRanksAreSetInSofie?: boolean

	/** Previous state persisted from ShowStyleBlueprint.onTimelineGenerate */
	previousPersistentState?: TimelinePersistentState
	/** AB playback sessions calculated in the last call to ShowStyleBlueprint.onTimelineGenerate */
	trackedAbSessions?: ABSessionInfo[]
}

/** Note: Use RundownPlaylist instead */
export type DBRundownPlaylist = RundownPlaylist

/**
 * Direct database accessors for the RundownPlaylist
 * These used to reside on the Rundown class
 */
export class RundownPlaylistCollectionUtil {
	/** Returns all Rundowns in the RundownPlaylist */
	static getRundowns(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		return Rundowns.find(
			{
				playlistId: playlist._id,
				...selector,
			},
			{
				sort: {
					_rank: 1,
					_id: 1,
				},
				...options,
			}
		).fetch()
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist */
	static getRundownIDs(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): RundownId[] {
		return RundownPlaylistCollectionUtil.getRundowns(playlist, selector, {
			sort: {
				_rank: 1,
				_id: 1,
			},
			fields: {
				_rank: 1,
				_id: 1,
			},
			...options,
		}).map((i) => i._id)
	}
	static getRundownUnorderedIDs(playlist: Pick<RundownPlaylist, '_id'>, selector?: MongoQuery<Rundown>): RundownId[] {
		return RundownPlaylistCollectionUtil.getRundowns(playlist, selector, {
			fields: {
				_id: 1,
			},
		}).map((i) => i._id)
	}
	/** Return the studio for this RundownPlaylist */
	static getStudio(playlist: Pick<RundownPlaylist, '_id' | 'studioId'>): Studio {
		if (!playlist.studioId) throw new Meteor.Error(500, 'RundownPlaylist is not in a studio!')
		const studio = Studios.findOne(playlist.studioId)
		if (studio) {
			return studio
		} else throw new Meteor.Error(404, 'Studio "' + playlist.studioId + '" not found!')
	}
	/** Returns all segments joined with their rundowns in their correct oreder for this RundownPlaylist */
	static getRundownsAndSegments(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Array<{
		rundown: Pick<
			Rundown,
			'_id' | 'name' | '_rank' | 'playlistId' | 'timing' | 'showStyleBaseId' | 'endOfRundownIsShowBreak'
		>
		segments: Segment[]
	}> {
		const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist, undefined, {
			fields: {
				name: 1,
				_rank: 1,
				playlistId: 1,
				timing: 1,
				showStyleBaseId: 1,
				endOfRundownIsShowBreak: 1,
			},
		})
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
				...selector,
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
				...options,
			}
		).fetch()
		return RundownPlaylistCollectionUtil._matchSegmentsAndRundowns(segments, rundowns)
	}
	/** Returns all segments in their correct order for this RundownPlaylist */
	static getSegments(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Segment[] {
		const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist, undefined, {
			fields: {
				_rank: 1,
				playlistId: 1,
			},
		})
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
				...selector,
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
				...options,
			}
		).fetch()
		return RundownPlaylistCollectionUtil._sortSegments(segments, rundowns)
	}
	static getUnorderedParts(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Part>,
		options?: FindOptions<Part>
	): Part[] {
		const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist, undefined, {
			fields: {
				_id: 1,
				_rank: 1,
				name: 1,
			},
		})
		const parts = Parts.find(
			{
				...selector,
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
			},
			{
				...options,
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()
		return parts
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	static getSegmentsAndPartsSync(
		playlist: Pick<RundownPlaylist, '_id'>,
		segmentsQuery?: Mongo.Query<Segment>,
		partsQuery?: Mongo.Query<DBPart>,
		segmentsOptions?: FindOptions<DBSegment>,
		partsOptions?: FindOptions<DBPart>
	): { segments: Segment[]; parts: Part[] } {
		const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist, undefined, {
			fields: {
				_rank: 1,
				playlistId: 1,
			},
		})
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
				...segmentsQuery,
			},
			{
				...segmentsOptions,
				//@ts-ignore
				fields: segmentsOptions?.fields
					? {
							...segmentsOptions?.fields,
							_rank: 1,
							rundownId: 1,
					  }
					: undefined,
				sort: {
					...segmentsOptions?.sort,
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()

		const parts = Parts.find(
			{
				rundownId: {
					$in: rundowns.map((i) => i._id),
				},
				...partsQuery,
			},
			{
				...partsOptions,
				//@ts-ignore
				fields: partsOptions?.fields
					? {
							...partsOptions?.fields,
							rundownId: 1,
							segmentId: 1,
							_rank: 1,
					  }
					: undefined,
				//@ts-ignore
				sort: {
					...segmentsOptions?.sort,
					rundownId: 1,
					_rank: 1,
				},
			}
		).fetch()

		const sortedSegments = RundownPlaylistCollectionUtil._sortSegments(segments, rundowns)
		return {
			segments: sortedSegments,
			parts: RundownPlaylistCollectionUtil._sortPartsInner(parts, sortedSegments),
		}
	}
	static getSelectedPartInstances(
		playlist: Pick<
			RundownPlaylist,
			'_id' | 'currentPartInstanceId' | 'previousPartInstanceId' | 'nextPartInstanceId'
		>,
		rundownIds0?: RundownId[]
	) {
		let rundownIds = rundownIds0
		if (!rundownIds) {
			rundownIds = RundownPlaylistCollectionUtil.getRundownIDs(playlist)
		}

		const ids = _.compact([
			playlist.currentPartInstanceId,
			playlist.previousPartInstanceId,
			playlist.nextPartInstanceId,
		])
		const instances =
			ids.length > 0
				? PartInstances.find({
						rundownId: { $in: rundownIds },
						_id: { $in: ids },
						reset: { $ne: true },
				  }).fetch()
				: []

		return {
			currentPartInstance: instances.find((inst) => inst._id === playlist.currentPartInstanceId),
			nextPartInstance: instances.find((inst) => inst._id === playlist.nextPartInstanceId),
			previousPartInstance: instances.find((inst) => inst._id === playlist.previousPartInstanceId),
		}
	}

	static getAllPartInstances(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	) {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownIDs(playlist)

		return PartInstances.find(
			{
				rundownId: { $in: rundownIds },
				...selector,
			},
			{
				sort: { takeCount: 1 },
				...options,
			}
		).fetch()
	}
	static getActivePartInstances(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): PartInstance[] {
		const newSelector = {
			...selector,
			reset: { $ne: true },
		}
		return RundownPlaylistCollectionUtil.getAllPartInstances(playlist, newSelector, options)
	}
	static getActivePartInstancesMap(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	) {
		const instances = RundownPlaylistCollectionUtil.getActivePartInstances(playlist, selector, options)
		return normalizeArrayFunc(instances, (i) => unprotectString(i.part._id))
	}

	static _sortSegments<TSegment extends Pick<Segment, '_id' | 'rundownId' | '_rank'>>(
		segments: Array<TSegment>,
		rundowns: Array<ReadonlyDeep<DBRundown>>
	) {
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
	static _matchSegmentsAndRundowns<T extends DBRundown, E extends DBSegment>(segments: E[], rundowns: T[]) {
		const rundownsMap = new Map<
			RundownId,
			{
				rundown: T
				segments: E[]
			}
		>()
		rundowns.forEach((rundown) => {
			rundownsMap.set(rundown._id, {
				rundown,
				segments: [],
			})
		})
		segments.forEach((segment) => {
			rundownsMap.get(segment.rundownId)?.segments.push(segment)
		})
		return Array.from(rundownsMap.values())
	}
	static _sortParts(
		parts: Part[],
		rundowns: DBRundown[],
		segments: Array<Pick<Segment, '_id' | 'rundownId' | '_rank'>>
	) {
		return RundownPlaylistCollectionUtil._sortPartsInner(
			parts,
			RundownPlaylistCollectionUtil._sortSegments(segments, rundowns)
		)
	}
	static _sortPartsInner<P extends DBPart>(parts: P[], sortedSegments: Array<Pick<Segment, '_id'>>): P[] {
		const segmentRanks: { [segmentId: string]: number } = {}
		_.each(sortedSegments, (segment, i) => (segmentRanks[unprotectString(segment._id)] = i))

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
}

export const RundownPlaylists = createMongoCollection<RundownPlaylist>('rundownPlaylists')
registerCollection('RundownPlaylists', RundownPlaylists)

registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})
