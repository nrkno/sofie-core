import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortSegmentsInRundowns, sortPartsInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import { DbCacheReadCollection } from './CacheCollection'
import { ReadonlyDeep } from 'type-fest'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export function getOrderedSegmentsAndPartsFromCacheCollections(
	partsCache: DbCacheReadCollection<DBPart>,
	segmentsCache: DbCacheReadCollection<DBSegment>,
	rundownIdsInOrder: ReadonlyDeep<RundownId[]>
): { segments: DBSegment[]; parts: DBPart[] } {
	const segments = sortSegmentsInRundowns(
		segmentsCache.findAll(null, {
			sort: {
				rundownId: 1,
				_rank: 1,
			},
		}),
		rundownIdsInOrder
	)

	const parts = sortPartsInSortedSegments(
		partsCache.findAll(null, {
			sort: {
				rundownId: 1,
				_rank: 1,
			},
		}),
		segments
	)

	return {
		segments: segments,
		parts: parts,
	}
}
