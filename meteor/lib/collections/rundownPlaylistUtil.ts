import { PartId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Rundown, DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { normalizeArrayToMap, normalizeArrayFunc, groupByToMap } from '@sofie-automation/corelib/dist/lib'
import {
	sortRundownIDsInPlaylist,
	sortSegmentsInRundowns,
	sortPartsInSegments,
	sortPartsInSortedSegments,
} from '@sofie-automation/corelib/dist/playout/playlist'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'
import { Rundowns, Segments, Parts, PartInstances, Pieces } from './libCollections'
import { FindOptions } from './lib'
import { PartInstance } from './PartInstances'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'

/**
 * Direct database accessors for the RundownPlaylist
 * These used to reside on the Rundown class
 */
export class RundownPlaylistCollectionUtil {
	/** Returns an array of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownsOrdered(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		const allRundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist._id, selector, options)

		const rundownsMap = normalizeArrayToMap(allRundowns, '_id')

		const sortedIds = sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, Array.from(rundownsMap.keys()))

		return _.compact(sortedIds.map((id) => rundownsMap.get(id)))
	}
	/** Returns an array of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownsUnordered(
		playlistId: RundownPlaylistId,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		return Rundowns.find(
			{
				playlistId: playlistId,
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
	static getRundownOrderedIDs(playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>): RundownId[] {
		const allIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)

		return sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, allIds)
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownUnorderedIDs(playlist: Pick<DBRundownPlaylist, '_id'>): RundownId[] {
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

	/** Returns all segments joined with their rundowns in their correct oreder for this RundownPlaylist */
	static getRundownsAndSegments(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<DBSegment>,
		options?: FindOptions<DBSegment>
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
		segments: DBSegment[]
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
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<DBSegment>,
		options?: FindOptions<DBSegment>
	): DBSegment[] {
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
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<DBPart>,
		options?: FindOptions<DBPart>
	): DBPart[] {
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
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		segmentsQuery?: MongoQuery<DBSegment>,
		partsQuery?: MongoQuery<DBPart>,
		segmentsOptions?: Omit<FindOptions<DBSegment>, 'projection'>, // We are mangling fields, so block projection
		partsOptions?: Omit<FindOptions<DBPart>, 'projection'> // We are mangling fields, so block projection
	): { segments: DBSegment[]; parts: DBPart[] } {
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
				//@ts-expect-error This is too clever for the compiler
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
				//@ts-expect-error This is too clever for the compiler
				fields: partsOptions?.fields
					? {
							...partsOptions?.fields,
							rundownId: 1,
							segmentId: 1,
							_rank: 1,
					  }
					: undefined,
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
		playlist: Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'previousPartInfo' | 'nextPartInfo'>,
		rundownIds0?: RundownId[]
	): {
		currentPartInstance: PartInstance | undefined
		nextPartInstance: PartInstance | undefined
		previousPartInstance: PartInstance | undefined
	} {
		let unorderedRundownIds = rundownIds0
		if (!unorderedRundownIds) {
			unorderedRundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		}

		const ids = _.compact([
			playlist.currentPartInfo?.partInstanceId,
			playlist.previousPartInfo?.partInstanceId,
			playlist.nextPartInfo?.partInstanceId,
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
			currentPartInstance: instances.find((inst) => inst._id === playlist.currentPartInfo?.partInstanceId),
			nextPartInstance: instances.find((inst) => inst._id === playlist.nextPartInfo?.partInstanceId),
			previousPartInstance: instances.find((inst) => inst._id === playlist.previousPartInfo?.partInstanceId),
		}
	}

	static getAllPartInstances(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): PartInstance[] {
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
		playlist: Pick<DBRundownPlaylist, '_id'>,
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
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<PartInstance>,
		options?: FindOptions<PartInstance>
	): Record<string, PartInstance> {
		const instances = RundownPlaylistCollectionUtil.getActivePartInstances(playlist, selector, options)
		return normalizeArrayFunc(instances, (i) => unprotectString(i.part._id))
	}
	static getPiecesForParts(
		parts: Array<PartId>,
		piecesOptions?: Omit<FindOptions<Piece>, 'projection'> // We are mangling fields, so block projection
	): Map<PartId, Piece[]> {
		const allPieces = Pieces.find(
			{ startPartId: { $in: parts } },
			{
				...piecesOptions,
				//@ts-expect-error This is too clever for the compiler
				fields: piecesOptions?.fields
					? {
							...piecesOptions?.fields,
							startPartId: 1,
					  }
					: undefined,
			}
		).fetch()
		return groupByToMap(allPieces, 'startPartId')
	}

	static _sortSegments<TSegment extends Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>(
		segments: Array<TSegment>,
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>
	): TSegment[] {
		return sortSegmentsInRundowns(segments, playlist.rundownIdsInOrder)
	}
	static _matchSegmentsAndRundowns<T extends DBRundown, E extends DBSegment>(
		segments: E[],
		rundowns: T[]
	): Array<{ rundown: T; segments: E[] }> {
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
		parts: DBPart[],
		playlist: Pick<DBRundownPlaylist, 'rundownIdsInOrder'>,
		segments: Array<Pick<DBSegment, '_id' | 'rundownId' | '_rank'>>
	): DBPart[] {
		return sortPartsInSegments(parts, playlist.rundownIdsInOrder, segments)
	}
	static _sortPartsInner<P extends Pick<DBPart, '_id' | 'segmentId' | '_rank'>>(
		parts: P[],
		sortedSegments: Array<Pick<DBSegment, '_id'>>
	): P[] {
		return sortPartsInSortedSegments(parts, sortedSegments)
	}
}
