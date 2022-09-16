import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
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

			const removedPieceIds = cache.Pieces.remove((p) => removedPartIds2.has(p.startPartId))
			const removedAdlibIds = cache.AdLibPieces.remove((e) => !!e.partId && removedPartIds2.has(e.partId))
			const removedActionIds = cache.AdLibActions.remove((e) => removedPartIds2.has(e.partId))
			const allRemovedPieceIds: Set<NonNullable<ExpectedPackageDB['pieceId']>> = new Set([
				...removedPieceIds,
				...removedAdlibIds,
				...removedActionIds,
			])

			cache.ExpectedPackages.remove((e) => !!e.pieceId && allRemovedPieceIds.has(e.pieceId))
			cache.ExpectedPlayoutItems.remove((e) => 'partId' in e && !!e.partId && removedPartIds2.has(e.partId))
			cache.ExpectedMediaItems.remove((e) => 'partId' in e && !!e.partId && removedPartIds2.has(e.partId))
		}
	}
}
