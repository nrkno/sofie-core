import { ShowStyleBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { Rundown } from '../../../lib/collections/Rundowns'
import { getShowStyleCompound2, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { CacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from '../expectedMediaItems'
import { wrapWithProxyPlayoutCache } from '../playout/cache'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
import { ChangedSegmentsRankInfo, updatePartInstancesBasicProperties, updatePartInstanceRanks } from '../rundown'
import { CacheForIngest } from './cache'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import { getRundown2 } from './lib'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { CommitIngestData, IngestPlayoutInfo } from './syncFunction'
import { UpdateNext } from './updateNext'

export async function CommitIngestOperation(
	ingestCache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo | undefined,
	data: CommitIngestData
): Promise<void> {
	const rundown = getRundown2(ingestCache)

	const showStyle = data.showStyle ?? (await getShowStyleCompound2(rundown))
	const blueprint = (data.showStyle ? data.blueprint : undefined) ?? loadShowStyleBlueprint(showStyle)

	// Removing segment
	// if (!canRemoveSegment(cache, playlist, segment)) {
	//     unsyncAndEmptySegment(cache, rundownId, segmentId)
	// } else {

	//     cache.Segments.remove(segmentId)
	//     removeSegmentContents(cache, rundownId, [segmentId])

	//     UpdateNext.ensureNextPartIsValid(cache, playlist)
	// }

	afterIngestChangedData(ingestCache, showStyle, blueprint.blueprint, rundown, [
		{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
	])
}

export function afterIngestChangedData( // TODO - private
	cache: CacheForRundownPlaylist,
	showStyle: ShowStyleCompound,
	blueprint: ShowStyleBlueprintManifest,
	rundown: Rundown,
	changedSegments: ChangedSegmentsRankInfo
) {
	const playlist = cache.RundownPlaylists.findOne({ _id: rundown.playlistId })
	if (!playlist) {
		throw new Meteor.Error(404, `Orphaned rundown ${rundown._id}`)
	}

	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(cache, rundown._id)
	updateExpectedPlayoutItemsOnRundown(cache, rundown._id)

	updatePartInstancesBasicProperties(cache, playlist, rundown._id)

	updatePartInstanceRanks(cache, changedSegments)

	UpdateNext.ensureNextPartIsValid(cache, playlist)

	wrapWithProxyPlayoutCache(cache, playlist, (playoutCache) => {
		syncChangesToPartInstances(playoutCache, cache, showStyle, blueprint, rundown)
	})

	triggerUpdateTimelineAfterIngestData(rundown.playlistId)
}
