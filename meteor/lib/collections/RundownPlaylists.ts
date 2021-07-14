import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { MongoQuery, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { Time, applyClassToDocument, normalizeArrayFunc, unprotectString } from '../lib'
import { Rundowns, Rundown, DBRundown } from './Rundowns'
import { Studio, Studios } from './Studios'
import { Segments, Segment, DBSegment } from './Segments'
import { Parts, Part, DBPart } from './Parts'
import { TimelinePersistentState } from '@sofie-automation/blueprints-integration'
import {
	sortPartsInSegments,
	sortPartsInSortedSegments,
	sortSegmentsInRundowns,
} from '@sofie-automation/corelib/dist/playout/playlist'
import { PartInstance, PartInstances } from './PartInstances'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ReadonlyDeep } from 'type-fest'
import {
	RundownPlaylistId,
	ActiveInstanceId,
	RundownPlaylistActivationId,
	OrganizationId,
	PartInstanceId,
	SegmentId,
	StudioId,
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownPlaylistId, ActiveInstanceId, RundownPlaylistActivationId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import {
	DBRundownPlaylist,
	ABSessionInfo,
	RundownHoldState,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
export { DBRundownPlaylist, ABSessionInfo }

export class RundownPlaylist implements DBRundownPlaylist {
	public _id: RundownPlaylistId
	public externalId: string
	public organizationId: OrganizationId
	public studioId: StudioId
	public restoredFromSnapshotId?: RundownPlaylistId
	public name: string
	public created: Time
	public modified: Time
	public startedPlayback?: Time
	public lastIncorrectPartPlaybackReported?: Time
	public rundownsStartedPlayback?: Record<string, Time>
	public expectedStart?: Time
	public expectedDuration?: number
	public rehearsal?: boolean
	public holdState?: RundownHoldState
	public activationId?: RundownPlaylistActivationId
	public currentPartInstanceId: PartInstanceId | null
	public nextPartInstanceId: PartInstanceId | null
	public nextSegmentId?: SegmentId
	public nextTimeOffset?: number | null
	public nextPartManual?: boolean
	public previousPartInstanceId: PartInstanceId | null
	public loop?: boolean
	public outOfOrderTiming?: boolean
	public timeOfDayCountdowns?: boolean
	public rundownRanksAreSetInSofie?: boolean

	public previousPersistentState?: TimelinePersistentState
	public trackedAbSessions?: ABSessionInfo[]

	constructor(document: DBRundownPlaylist) {
		for (const [key, value] of Object.entries(document)) {
			this[key] = value
		}
	}
	/** Returns all Rundowns in the RundownPlaylist */
	getRundowns(selector?: MongoQuery<DBRundown>, options?: FindOptions<DBRundown>): Rundown[] {
		return Rundowns.find(
			_.extend(
				{
					playlistId: this._id,
				},
				selector
			),
			_.extend(
				{
					sort: {
						_rank: 1,
						_id: 1,
					},
				},
				options
			)
		).fetch()
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist */
	getRundownIDs(selector?: MongoQuery<DBRundown>, options?: FindOptions<DBRundown>): RundownId[] {
		return this.getRundowns(
			selector,
			_.extend(
				{
					sort: {
						_rank: 1,
						_id: 1,
					},
					fields: {
						_rank: 1,
						_id: 1,
					},
				},
				options
			)
		).map((i) => i._id)
	}
	getRundownUnorderedIDs(selector?: MongoQuery<DBRundown>): RundownId[] {
		return this.getRundowns(selector, {
			fields: {
				_id: 1,
			},
		}).map((i) => i._id)
	}
	/** Return the studio for this RundownPlaylist */
	getStudio(): Studio {
		if (!this.studioId) throw new Meteor.Error(500, 'RundownPlaylist is not in a studio!')
		const studio = Studios.findOne(this.studioId)
		if (studio) {
			return studio
		} else throw new Meteor.Error(404, 'Studio "' + this.studioId + '" not found!')
	}
	/** Returns all segments joined with their rundowns in their correct oreder for this RundownPlaylist */
	getRundownsAndSegments(
		selector?: MongoQuery<DBSegment>,
		options?: FindOptions<DBSegment>
	): Array<{
		rundown: Rundown
		segments: Segment[]
	}> {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				name: 1,
				_rank: 1,
				playlistId: 1,
				expectedStart: 1,
				expectedDuration: 1,
				showStyleBaseId: 1,
			},
		})
		const segments = Segments.find(
			_.extend(
				{
					rundownId: {
						$in: rundowns.map((i) => i._id),
					},
				},
				selector
			),
			_.extend(
				{
					sort: {
						rundownId: 1,
						_rank: 1,
					},
				},
				options
			)
		).fetch()
		return RundownPlaylist._matchSegmentsAndRundowns(segments, rundowns)
	}
	/** Returns all segments in their correct order for this RundownPlaylist */
	getSegments(selector?: MongoQuery<DBSegment>, options?: FindOptions<DBSegment>): Segment[] {
		const rundowns = this.getRundowns(undefined, {
			fields: {
				_rank: 1,
				playlistId: 1,
			},
		})
		const segments = Segments.find(
			_.extend(
				{
					rundownId: {
						$in: rundowns.map((i) => i._id),
					},
				},
				selector
			),
			_.extend(
				{
					sort: {
						rundownId: 1,
						_rank: 1,
					},
				},
				options
			)
		).fetch()
		return RundownPlaylist._sortSegments(segments, rundowns)
	}
	getAllOrderedParts(selector?: MongoQuery<DBPart>, options?: FindOptions<DBPart>): Part[] {
		const { parts } = this.getSegmentsAndPartsSync(undefined, selector, undefined, options)
		return parts
	}
	getUnorderedParts(selector?: MongoQuery<DBPart>, options?: FindOptions<DBPart>): Part[] {
		const rundowns = this.getRundowns(undefined, {
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
	getSegmentsAndPartsSync(
		segmentsQuery?: Mongo.Query<DBSegment>,
		partsQuery?: Mongo.Query<DBPart>,
		segmentsOptions?: FindOptions<DBSegment>,
		partsOptions?: FindOptions<DBPart>
	): { segments: Segment[]; parts: Part[] } {
		const rundowns = this.getRundowns(undefined, {
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

		const sortedSegments = RundownPlaylist._sortSegments(segments, rundowns)
		return {
			segments: sortedSegments,
			parts: RundownPlaylist._sortPartsInner(parts, sortedSegments),
		}
	}
	getSelectedPartInstances(rundownIds0?: RundownId[]) {
		let rundownIds = rundownIds0
		if (!rundownIds) {
			rundownIds = this.getRundownIDs()
		}

		const ids = _.compact([this.currentPartInstanceId, this.previousPartInstanceId, this.nextPartInstanceId])
		const instances =
			ids.length > 0
				? PartInstances.find({
						rundownId: { $in: rundownIds },
						_id: { $in: ids },
						reset: { $ne: true },
				  }).fetch()
				: []

		return {
			currentPartInstance: instances.find((inst) => inst._id === this.currentPartInstanceId),
			nextPartInstance: instances.find((inst) => inst._id === this.nextPartInstanceId),
			previousPartInstance: instances.find((inst) => inst._id === this.previousPartInstanceId),
		}
	}
	getAllPartInstances(selector?: MongoQuery<PartInstance>, options?: FindOptions<PartInstance>) {
		const rundownIds = this.getRundownIDs()

		selector = selector || {}
		options = options || {}
		return PartInstances.find(
			_.extend(
				{
					rundownId: { $in: rundownIds },
				},
				selector
			),
			_.extend(
				{
					sort: { takeCount: 1 },
				},
				options
			)
		).fetch()
	}
	getActivePartInstances(selector?: MongoQuery<PartInstance>, options?: FindOptions<PartInstance>) {
		const newSelector = {
			...selector,
			reset: { $ne: true },
		}
		return this.getAllPartInstances(newSelector, options)
	}
	getActivePartInstancesMap(selector?: MongoQuery<PartInstance>, options?: FindOptions<PartInstance>) {
		const instances = this.getActivePartInstances(selector, options)
		return normalizeArrayFunc(instances, (i) => unprotectString(i.part._id))
	}
	static _sortSegments(segments: Segment[], rundowns: Array<ReadonlyDeep<DBRundown>>) {
		return sortSegmentsInRundowns(segments, rundowns)
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
	static _sortParts(parts: Part[], rundowns: DBRundown[], segments: Segment[]) {
		return sortPartsInSegments(parts, rundowns, segments)
	}
	static _sortPartsInner<P extends DBPart>(parts: P[], sortedSegments: DBSegment[]): P[] {
		return sortPartsInSortedSegments(parts, sortedSegments)
	}
}

export const RundownPlaylists = createMongoCollection<RundownPlaylist, DBRundownPlaylist>(
	CollectionName.RundownPlaylists,
	{
		transform: (doc) => applyClassToDocument(RundownPlaylist, doc),
	}
)

registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})
