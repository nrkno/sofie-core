import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { MongoQuery, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { normalizeArrayFunc, unprotectString } from '../lib'
import { Rundowns, Rundown, DBRundown } from './Rundowns'
import { Studio, Studios } from './Studios'
import { Segments, Segment, DBSegment } from './Segments'
import { Parts, Part, DBPart } from './Parts'
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
	RundownId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownPlaylistId, ActiveInstanceId, RundownPlaylistActivationId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
export * from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

/** Note: Use RundownPlaylist instead */
export type RundownPlaylist = DBRundownPlaylist

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
			| '_id'
			| 'name'
			| '_rank'
			| 'playlistId'
			| 'timing'
			| 'showStyleBaseId'
			| 'showStyleVariantId'
			| 'endOfRundownIsShowBreak'
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
				showStyleVariantId: 1,
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
	static _sortParts(
		parts: Part[],
		rundowns: DBRundown[],
		segments: Array<Pick<Segment, '_id' | 'rundownId' | '_rank'>>
	) {
		return sortPartsInSegments(parts, rundowns, segments)
	}
	static _sortPartsInner<P extends DBPart>(parts: P[], sortedSegments: Array<Pick<Segment, '_id'>>): P[] {
		return sortPartsInSortedSegments(parts, sortedSegments)
	}
}

export const RundownPlaylists = createMongoCollection<RundownPlaylist>(CollectionName.RundownPlaylists)

registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})
