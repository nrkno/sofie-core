import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { PartId } from '../../../lib/collections/Parts'
import { RundownId } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { waitForPromiseAll, asyncCollectionRemove } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { CacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { getSelectedPartInstancesFromCache } from '../playout/cache'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'

/**
 * Removes the contents of specified Segments from the cache/database
 * @param rundownId The Rundown id to remove from
 * @param segmentIds The Segment ids to be removed
 */
export function removeSegmentContents(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	segmentIds0: SegmentId[]
): void {
	const segmentIds = new Set(segmentIds0)
	const removedPartIds = cache.Parts.remove((p) => segmentIds.has(p.segmentId))

	if (removedPartIds.length > 0) {
		removeSegmentsParts(cache, rundownId, removedPartIds)

		triggerUpdateTimelineAfterIngestData(cache.containsDataFromPlaylist)
	}
}
export function unsyncAndEmptySegment(cache: CacheForRundownPlaylist, rundownId: RundownId, segmentId: SegmentId) {
	cache.Segments.update(segmentId, {
		$set: {
			orphaned: 'deleted',
		},
	})

	if (!Settings.allowUnsyncedSegments) {
		// Remove everything inside the segment
		removeSegmentContents(cache, rundownId, [segmentId])

		// Mark all the instances as deleted
		cache.PartInstances.update((p) => !p.reset && p.segmentId === segmentId && !p.orphaned, {
			$set: {
				orphaned: 'deleted',
			},
		})
	}
}
/**
 * After Parts have been removed, handle the contents.
 * This will NOT trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param removedParts The parts that have been removed
 */
function removeSegmentsParts(cache: CacheForRundownPlaylist, rundownId: RundownId, removedPartIds: PartId[]) {
	// Clean up all the db items that belong to the removed Parts
	cache.Pieces.remove({
		startRundownId: rundownId,
		startPartId: { $in: removedPartIds },
	})

	afterRemoveParts(cache, removedPartIds)

	cache.deferAfterSave(() => {
		waitForPromiseAll([
			asyncCollectionRemove(ExpectedPlayoutItems, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(ExpectedMediaItems, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(AdLibPieces, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(AdLibActions, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
		])
	})
}

/**
 * After Parts have been removed, inform the partInstances.
 * This will NOT remove any data or update the timeline
 * @param removedPartIds The ids of the parts that have been removed
 */
export function afterRemoveParts(cache: CacheForRundownPlaylist, removedPartIds: PartId[]) {
	const removedPartIdsSet = new Set(removedPartIds)

	const playlist = cache.RundownPlaylists.findOne(cache.containsDataFromPlaylist)
	if (playlist) {
		// Update the selected partinstances

		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
		const removePartInstanceIds = cache.PartInstances.findFetch(
			(p) =>
				removedPartIdsSet.has(p.part._id) &&
				!p.reset &&
				p._id !== currentPartInstance?._id &&
				p._id !== nextPartInstance?._id
		).map((p) => p._id)
		cache.PartInstances.update({ _id: { $in: removePartInstanceIds } }, { $set: { reset: true } })
		cache.PieceInstances.update({ partInstanceId: { $in: removePartInstanceIds } }, { $set: { reset: true } })
	}
}
