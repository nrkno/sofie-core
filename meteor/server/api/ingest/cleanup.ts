import { isExpectedPlayoutItemRundown } from '../../../lib/collections/ExpectedPlayoutItems'
import { SegmentId } from '../../../lib/collections/Segments'
import { CacheForIngest } from './cache'

/**
 * Removes the contents of specified Segments from the cache/database
 * @param rundownId The Rundown id to remove from
 * @param segmentIds The Segment ids to be removed
 */
export function removeSegmentContents(cache: CacheForIngest, segmentIds: Set<SegmentId>): void {
	if (segmentIds.size > 0) {
		const removedPartIds = cache.Parts.remove((p) => segmentIds.has(p.segmentId))

		if (removedPartIds.length > 0) {
			// Clean up all the db items that belong to the removed Parts
			const removedPartIds2 = new Set(removedPartIds)
			cache.Pieces.remove((p) => removedPartIds2.has(p.startPartId))
			cache.ExpectedPlayoutItems.remove(
				(e) => isExpectedPlayoutItemRundown(e) && e.partId && removedPartIds2.has(e.partId)
			)
			cache.ExpectedMediaItems.remove((e) => 'partId' in e && e.partId && removedPartIds2.has(e.partId))
			cache.AdLibPieces.remove((e) => e.partId && removedPartIds2.has(e.partId))
			cache.AdLibActions.remove((e) => removedPartIds2.has(e.partId))
		}
	}
}
