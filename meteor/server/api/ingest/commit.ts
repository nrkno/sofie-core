import { getShowStyleCompound2 } from '../../../lib/collections/ShowStyleVariants'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
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

	// Update rundown
	// // Do a check if we're allowed to move out of currently playing playlist:
	// if (existingDbRundown && existingDbRundown.playlistExternalId !== dbRundownData.playlistExternalId) {
	// 	// The rundown is going to change playlist
	// 	const existingPlaylist = RundownPlaylists.findOne(existingDbRundown.playlistId)
	// 	if (existingPlaylist) {
	// 		if (!allowedToMoveRundownOutOfPlaylist(existingPlaylist, existingDbRundown)) {
	// 			// The rundown contains a PartInstance that is currently on air.
	// 			// We're trying for a "soft approach" here, instead of rejecting the change altogether,
	// 			// and will just revert the playlist change:

	// 			dbRundownData.playlistExternalId = existingDbRundown.playlistExternalId
	// 			dbRundownData.playlistId = existingDbRundown.playlistId

	// 			if (!dbRundownData.notes) dbRundownData.notes = []
	// 			dbRundownData.notes.push({
	// 				type: NoteType.WARNING,
	// 				message: {
	// 					key:
	// 						'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
	// 				},
	// 				origin: {
	// 					name: 'Data update',
	// 				},
	// 			})

	// 			logger.warn(
	// 				`Blocking moving rundown "${existingDbRundown._id}" out of playlist "${existingDbRundown.playlistId}"`
	// 			)
	// 		}
	// 	} else {
	// 		logger.warn(`Existing playlist "${existingDbRundown.playlistId}" not found`)
	// 	}
	// }

	// const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(studio, dbRundownData, peripheralDevice)
	// dbRundownData.playlistId = rundownPlaylistInfo.rundownPlaylist._id
	// const playlistChanges = saveIntoDb(
	// 	RundownPlaylists,
	// 	{
	// 		_id: rundownPlaylistInfo.rundownPlaylist._id,
	// 	},
	// 	[rundownPlaylistInfo.rundownPlaylist],
	// 	{
	// 		beforeInsert: (o) => {
	// 			o.created = getCurrentTime()
	// 			o.modified = getCurrentTime()
	// 			o.previousPartInstanceId = null
	// 			o.currentPartInstanceId = null
	// 			o.nextPartInstanceId = null
	// 			return o
	// 		},
	// 		beforeUpdate: (o) => {
	// 			o.modified = getCurrentTime()
	// 			return o
	// 		},
	// 	}
	// )
	// updateRundownsInPlaylist(rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order, dbRundown)
	// cache.deferAfterSave(() => {
	// 	const studioId = cache.Studio.doc._id
	// 	Meteor.defer(() => {
	// 		// It needs to lock every playlist, and we are already inside one of the locks it needs
	// 		removeEmptyPlaylists(studioId)
	// 	})
	// })

	// Rundown changed
	// cache.defer((cache) => {
	// 	reportRundownDataHasChanged(cache, dbPlaylist, dbRundown)
	// })

	// Removing rundown
	// if (!allowedToMoveRundownOutOfPlaylist(playlist, rundown)) {
	// 	// Don't allow removing currently playing rundown playlists:
	// 	logger.warn(
	// 		`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
	// 	)
	// 	ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
	// } else {
	// 	logger.info(`Removing rundown "${rundown._id}"`)
	// 	removeRundownFromCache(cache, rundown)
	// }

	// Removing segment
	// if (!canRemoveSegment(cache, playlist, segment)) {
	//     unsyncAndEmptySegment(cache, rundownId, segmentId)
	// } else {

	//     cache.Segments.remove(segmentId)
	//     removeSegmentContents(cache, rundownId, [segmentId])

	//     UpdateNext.ensureNextPartIsValid(cache, playlist)
	// }

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
