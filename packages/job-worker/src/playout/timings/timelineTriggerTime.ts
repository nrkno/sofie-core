import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnTimelineTriggerTimeProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../../logging'
import _ = require('underscore')
import { JobContext } from '../../jobs'
import { runJobWithPlaylistLock } from '../lock'
import { saveTimeline } from '../timeline/generate'
import { applyToArray } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { runJobWithStudioCache } from '../../studio/lock'
import { CacheForStudio } from '../../studio/cache'
import { DbCacheWriteCollection } from '../../cache/CacheCollection'
import { PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'

/**
 * Called from Playout-gateway when the trigger-time of a timeline object has updated
 * ( typically when using the "now"-feature )
 */
export async function handleTimelineTriggerTime(context: JobContext, data: OnTimelineTriggerTimeProps): Promise<void> {
	if (data.results.length > 0) {
		await runJobWithStudioCache(context, async (studioCache) => {
			const activePlaylists = studioCache.getActiveRundownPlaylists()

			if (studioCache.isMultiGatewayMode) {
				logger.warn(`Ignoring timelineTriggerTime call for studio not using now times`)
				return
			}

			if (activePlaylists.length === 1) {
				// If there is a playlist active, this needs to be done inside the playlistLock
				const activePlaylist = activePlaylists[0]
				const playlistId = activePlaylist._id
				await runJobWithPlaylistLock(context, { playlistId }, async () => {
					const rundownIDs = (
						await context.directCollections.Rundowns.findFetch({ playlistId }, { projection: { _id: 1 } })
					).map((r) => r._id)
					const partInstanceIDs = [activePlaylist.currentPartInfo?.partInstanceId].filter(
						(id): id is PartInstanceId => id !== null
					)

					// We only need the PieceInstances, so load just them
					const pieceInstanceCache = await DbCacheWriteCollection.createFromDatabase(
						context,
						context.directCollections.PieceInstances,
						{
							rundownId: { $in: rundownIDs },
							partInstanceId: {
								$in: partInstanceIDs,
							},
						}
					)

					// Take ownership of the playlist in the db, so that we can mutate the timeline and piece instances
					timelineTriggerTimeInner(context, studioCache, data.results, pieceInstanceCache, activePlaylist)

					await pieceInstanceCache.updateDatabaseWithData(null) // Single operation
				})
			} else {
				// No playlist is active. no extra lock needed
				timelineTriggerTimeInner(context, studioCache, data.results, undefined, undefined)
			}
		})
	}
}

function timelineTriggerTimeInner(
	context: JobContext,
	cache: CacheForStudio,
	results: OnTimelineTriggerTimeProps['results'],
	pieceInstanceCache: DbCacheWriteCollection<PieceInstance> | undefined,
	activePlaylist: DBRundownPlaylist | undefined
) {
	let lastTakeTime: number | undefined

	// ------------------------------
	const timeline = cache.Timeline.doc
	if (timeline) {
		const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)
		let tlChanged = false

		_.each(results, (o) => {
			logger.debug(`Timeline: Setting time: "${o.id}": ${o.time}`)

			const obj = timelineObjs.find((tlo) => tlo.id === o.id)
			if (obj) {
				applyToArray(obj.enable, (enable) => {
					if (enable.start === 'now') {
						enable.start = o.time
						enable.setFromNow = true

						tlChanged = true
					}
				})

				// TODO - we should do the same for the partInstance.
				// Or should we not update the now for them at all? as we should be getting the onPartPlaybackStarted immediately after

				const objPieceInstanceId = (obj.metaData as Partial<PieceTimelineMetadata> | undefined)
					?.triggerPieceInstanceId
				if (objPieceInstanceId && activePlaylist && pieceInstanceCache) {
					logger.debug('Update PieceInstance: ', {
						pieceId: objPieceInstanceId,
						time: new Date(o.time).toTimeString(),
					})

					const pieceInstance = pieceInstanceCache.findOne(objPieceInstanceId)
					if (
						pieceInstance &&
						pieceInstance.dynamicallyInserted &&
						pieceInstance.piece.enable.start === 'now'
					) {
						pieceInstanceCache.updateOne(pieceInstance._id, (p) => {
							p.piece.enable.start = o.time
							return p
						})

						const takeTime = pieceInstance.dynamicallyInserted
						lastTakeTime = lastTakeTime === undefined ? takeTime : Math.max(lastTakeTime, takeTime)
					}
				}
			}
		})

		if (lastTakeTime !== undefined && activePlaylist?.currentPartInfo && pieceInstanceCache) {
			// We updated some pieceInstance from now, so lets ensure any earlier adlibs do not still have a now
			const remainingNowPieces = pieceInstanceCache.findAll(
				(p) =>
					p.partInstanceId === activePlaylist.currentPartInfo?.partInstanceId &&
					p.dynamicallyInserted !== undefined &&
					!p.disabled
			)
			for (const piece of remainingNowPieces) {
				const pieceTakeTime = piece.dynamicallyInserted
				if (pieceTakeTime && pieceTakeTime <= lastTakeTime && piece.piece.enable.start === 'now') {
					// Delete the instance which has no duration
					pieceInstanceCache.remove(piece._id)
				}
			}
		}
		if (tlChanged) {
			saveTimeline(context, cache, timelineObjs, timeline.generationVersions)
		}
	}
}
