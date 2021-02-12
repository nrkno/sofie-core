import { getShowStyleCompound2 } from '../../../lib/collections/ShowStyleVariants'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { updateExpectedMediaItemsOnRundown } from './expectedMediaItems'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
import {
	allowedToMoveRundownOutOfPlaylist,
	ChangedSegmentsRankInfo,
	ServerRundownAPI,
	updatePartInstanceRanks,
} from '../rundown'
import { CacheForIngest } from './cache'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import { getRundown } from './lib'
import { syncChangesToPartInstances } from './syncChangesToPartInstance'
import { CommitIngestData, IngestPlayoutInfo } from './syncFunction'
import { UpdateNext } from './updateNext'
import { DBSegment } from '../../../lib/collections/Segments'
import { logger } from '../../logging'
import { isTooCloseToAutonext } from '../playout/lib'
import { RundownId } from '../../../lib/collections/Rundowns'

export async function CommitIngestOperation(
	ingestCache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo | undefined,
	data: CommitIngestData
): Promise<void> {
	const rundown = getRundown(ingestCache)

	// Start the delete process
	let purgeRundown = false
	if (data.removeRundown) {
		// ingestCache.removeRundown()
		if (playoutInfo && !allowedToMoveRundownOutOfPlaylist(playoutInfo.playlist, rundown)) {
			// Don't allow removing currently playing rundown playlists:
			logger.warn(
				`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
			)
			ServerRundownAPI.unsyncRundownInner(cache, rundown._id)

			// TODO?
			// if (!dbRundownData.notes) dbRundownData.notes = []
			// dbRundownData.notes.push({
			// 	type: NoteType.WARNING,
			// 	message: {
			// 		key:
			// 			'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
			// 	},
			// 	origin: {
			// 		name: 'Data update',
			// 	},
			// })
		} else {
			//
			ingestCache.removeRundown()
			purgeRundown = true
		}
	}

	// If it isn't being deleted, apply the other queued changes too
	if (!purgeRundown) {
		// TODO

		const showStyle = data.showStyle ?? (await getShowStyleCompound2(rundown))
		const blueprint = (data.showStyle ? data.blueprint : undefined) ?? loadShowStyleBlueprint(showStyle)

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

		// Cleanup removed segments
		// // Remove it too, if it can be removed
		// const segment = cache.Segments.findOne(segmentId)
		// if (canRemoveSegment(cache, playlist, segment)) {
		// 	cache.Segments.remove(segmentId)
		// }

		// TODO - existingRundownParts needs to be generated before the calcFcn
		// const changedSegments = newSegments.map((s) => ({
		// 			segmentId: s._id,
		// 			oldPartIdsAndRanks: (existingRundownParts[unprotectString(s._id)] || []).map((p) => ({
		// 				id: p._id,
		// 				rank: p._rank,
		// 			})),
		// 		}))

		// If anything changed?
		// triggerUpdateTimelineAfterIngestData(cache.containsDataFromPlaylist)

		// To be called after rundown has been changed
		updateExpectedMediaItemsOnRundown(ingestCache, rundown)
		updateExpectedPlayoutItemsOnRundown(ingestCache, rundown)
	}

	// We have finished preparing the rundown, lets ensure that any playlist playout things are updated if we had a PartInstance before
	// TODO - only if not deleted and there are other rundowns in the playlist
	if (playoutInfo) {
		updatePartInstancesBasicProperties(playoutCache, rundown._id, data.renamedSegments)

		updatePartInstanceRanks(playoutCache, changedSegments)

		UpdateNext.ensureNextPartIsValid(playoutCache)

		syncChangesToPartInstances(playoutCache, ingestCache, showStyle, blueprint.blueprint, rundown)

		triggerUpdateTimelineAfterIngestData(playoutCache.PlaylistId)
	}
}

function canRemoveSegment(cache: CacheForPlayout, segment: DBSegment | undefined): boolean {
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (
		segment &&
		(currentPartInstance?.segmentId === segment._id ||
			(nextPartInstance?.segmentId === segment._id && isTooCloseToAutonext(currentPartInstance, false)))
	) {
		// Don't allow removing an active rundown
		logger.warn(`Not allowing removal of current playing segment "${segment._id}", making segment unsynced instead`)
		return false
	}

	return true
}

/**
 * Ensure some 'basic' PartInstances properties are in sync with their parts
 */
function updatePartInstancesBasicProperties(
	cache: CacheForPlayout,
	rundownId: RundownId,
	renamedSegments: CommitIngestData['renamedSegments']
) {
	const playlist = cache.Playlist.doc
	const partInstances = cache.PartInstances.findFetch((p) => !p.reset && !p.orphaned && p.rundownId === rundownId)
	for (const partInstance of partInstances) {
		const part = cache.Parts.findOne(partInstance.part._id)
		if (!part) {
			// Part is deleted, so reset this instance if it isnt on-air
			if (
				playlist.currentPartInstanceId !== partInstance._id &&
				playlist.nextPartInstanceId !== partInstance._id
			) {
				cache.PartInstances.update(partInstance._id, { $set: { reset: true } })
			} else {
				cache.PartInstances.update(partInstance._id, { $set: { orphaned: 'deleted' } })
			}
		}
		// Follow any segment renames
		const newSegmentId = part?.segmentId ?? renamedSegments.get(partInstance.segmentId)
		if (newSegmentId) {
			cache.PartInstances.update(partInstance._id, {
				$set: {
					segmentId: newSegmentId,
					'part.segmentId': newSegmentId,
				},
			})
		}
	}
}
