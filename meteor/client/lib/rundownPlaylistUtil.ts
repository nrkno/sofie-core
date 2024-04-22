import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { FindOptions, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { RundownPlaylistCollectionUtil } from '../../lib/collections/rundownPlaylistUtil'
import { UIParts } from '../ui/Collections'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Segments } from '../collections'

export class RundownPlaylistClientUtil {
	static getUnorderedParts(
		playlist: Pick<DBRundownPlaylist, '_id'>,
		selector?: MongoQuery<DBPart>,
		options?: FindOptions<DBPart>
	): DBPart[] {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)
		const parts = UIParts.find(
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

		const parts = UIParts.find(
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
}
