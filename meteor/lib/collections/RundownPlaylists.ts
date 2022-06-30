import { Meteor } from 'meteor/meteor'
import { MongoQuery, FindOptions } from '../typings/meteor'
import * as _ from 'underscore'
import { normalizeArrayFunc, normalizeArrayToMap, unprotectString } from '../lib'
import { Studio, Studios } from './Studios'
import {
	sortPartsInSegments,
	sortPartsInSortedSegments,
	sortRundownIDsInPlaylist,
	sortSegmentsInRundowns,
} from '@sofie-automation/corelib/dist/playout/playlist'
import { Rundowns, Rundown, DBRundown } from './Rundowns'
import { Segments, Segment, DBSegment } from './Segments'
import { Parts, Part, DBPart } from './Parts'
import { PartInstance, PartInstances } from './PartInstances'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
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
	/** Returns an array of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownsOrdered(
		playlist: Pick<RundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		const allRundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist, selector, options)

		const rundownsMap = normalizeArrayToMap(allRundowns, '_id')

		const sortedIds = sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, Array.from(rundownsMap.keys()))

		return _.compact(sortedIds.map((id) => rundownsMap.get(id)))
	}
	/** Returns an array of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownsUnordered(
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
					_id: 1,
				},
				...options,
			}
		).fetch()
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownOrderedIDs(playlist: Pick<RundownPlaylist, '_id' | 'rundownIdsInOrder'>): RundownId[] {
		const allIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)

		return sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, allIds)
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownUnorderedIDs(playlist: Pick<RundownPlaylist, '_id'>): RundownId[] {
		const rundowns = Rundowns.find(
			{
				playlistId: playlist._id,
			},
			{
				fields: {
					_id: 1,
				},
			}
		).fetch() as Array<Pick<DBRundown, '_id'>>

		return rundowns.map((i) => i._id)
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
		playlist: Pick<RundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Array<{
		rundown: Pick<
			Rundown,
			| '_id'
			| 'name'
			| 'playlistId'
			| 'timing'
			| 'showStyleBaseId'
			| 'showStyleVariantId'
			| 'endOfRundownIsShowBreak'
		>
		segments: Segment[]
	}> {
		const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist, undefined, {
			fields: {
				name: 1,
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
		playlist: Pick<RundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Segment[] {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundownIds,
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
		return RundownPlaylistCollectionUtil._sortSegments(segments, playlist)
	}
	static getUnorderedParts(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<Part>,
		options?: FindOptions<Part>
	): Part[] {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const parts = Parts.find(
			{
				...selector,
				rundownId: {
					$in: rundownIds,
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
		playlist: Pick<RundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		segmentsQuery?: MongoQuery<Segment>,
		partsQuery?: MongoQuery<DBPart>,
		segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>, // We are mangling fields, so block projection
		partsOptions?: Omit<FindOptions<DBPart>, 'projection'> // We are mangling fields, so block projection
	): { segments: Segment[]; parts: Part[] } {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const segments = Segments.find(
			{
				rundownId: {
					$in: rundownIds,
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
					$in: rundownIds,
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

		const sortedSegments = RundownPlaylistCollectionUtil._sortSegments(segments, playlist)
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
		let unorderedRundownIds = rundownIds0
		if (!unorderedRundownIds) {
			unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		}

		const ids = _.compact([
			playlist.currentPartInstanceId,
			playlist.previousPartInstanceId,
			playlist.nextPartInstanceId,
		])
		const instances =
			ids.length > 0
				? PartInstances.find({
						rundownId: { $in: unorderedRundownIds },
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
		const unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)

		return PartInstances.find(
			{
				rundownId: { $in: unorderedRundownIds },
				...selector,
			},
			{
				sort: { takeCount: 1 },
				...options,
			}
		).fetch()
	}
	/** Return a list of PartInstances, omitting the reset ones (ie only the ones that are relevant) */
	static getActivePartInstances(
		playlist: Pick<RundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): PartInstance[] {
		const newSelector: MongoQuery<PartInstance> = {
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

	static _sortSegments<TSegment extends Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>(
		segments: Array<TSegment>,
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>
	) {
		return sortSegmentsInRundowns(segments, playlist)
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
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>,
		segments: Array<Pick<Segment, '_id' | 'rundownId' | '_rank'>>
	) {
		return sortPartsInSegments(parts, playlist, segments)
	}
	static _sortPartsInner<P extends Pick<DBPart, '_id' | 'segmentId' | '_rank'>>(
		parts: P[],
		sortedSegments: Array<Pick<Segment, '_id'>>
	): P[] {
		return sortPartsInSortedSegments(parts, sortedSegments)
	}
}

export const RundownPlaylists = createMongoCollection<RundownPlaylist>(CollectionName.RundownPlaylists)

registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})
