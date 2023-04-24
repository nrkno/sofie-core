import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { logger } from '../../logging'
import { JobContext } from '../../jobs'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getSelectedPartInstancesFromCache,
} from '../cache'
import { selectNextPart } from '../lib'
import { setNextPart } from '../setNext'
import { updateTimeline } from '../timeline/generate'
import { getCurrentTime } from '../../lib'
import { afterTake, clearNextSegmentId, resetPreviousSegment, updatePartInstanceOnTake } from '../take'
import { queuePartInstanceTimingEvent } from './events'
import { INCORRECT_PLAYING_PART_DEBOUNCE, RESET_IGNORE_ERRORS } from '../constants'
import { Time } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

/**
 * Set the playback of a part is confirmed to have started
 * If the part reported to be playing is not the current part, then make it be the current
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param data Details on the part start event
 */
export async function onPartPlaybackStarted(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		startedPlayback: Time
	}
): Promise<void> {
	const playingPartInstance = cache.PartInstances.findOne(data.partInstanceId)
	if (!playingPartInstance)
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlayst "${cache.PlaylistId}" not found!`)

	// make sure we don't run multiple times, even if TSR calls us multiple times
	const hasStartedPlaying = !!playingPartInstance.timings?.reportedStartedPlayback
	if (!hasStartedPlaying) {
		logger.debug(
			`Playout reports PartInstance "${data.partInstanceId}" has started playback on timestamp ${new Date(
				data.startedPlayback
			).toISOString()}`
		)

		const playlist = cache.Playlist.doc

		const rundown = cache.Rundowns.findOne(playingPartInstance.rundownId)
		if (!rundown) throw new Error(`Rundown "${playingPartInstance.rundownId}" not found!`)

		const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)

		if (playlist.currentPartInfo?.partInstanceId === data.partInstanceId) {
			// this is the current part, it has just started playback
			reportPartInstanceHasStarted(context, cache, playingPartInstance, data.startedPlayback)

			// complete the take
			await afterTake(context, cache, playingPartInstance)
		} else if (playlist.nextPartInfo?.partInstanceId === data.partInstanceId) {
			// this is the next part, clearly an autoNext has taken place

			cache.Playlist.update((p) => {
				p.previousPartInfo = p.currentPartInfo
				p.currentPartInfo = {
					partInstanceId: playingPartInstance._id,
					rundownId: playingPartInstance.rundownId,
				}
				p.holdState = RundownHoldState.NONE
				return p
			})

			reportPartInstanceHasStarted(context, cache, playingPartInstance, data.startedPlayback)

			// Update generated properties on the newly playing partInstance
			const currentRundown = currentPartInstance
				? cache.Rundowns.findOne(currentPartInstance.rundownId)
				: undefined
			const showStyleRundown = currentRundown ?? rundown
			const showStyle = await context.getShowStyleCompound(
				showStyleRundown.showStyleVariantId,
				showStyleRundown.showStyleBaseId
			)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			updatePartInstanceOnTake(
				context,
				cache,
				showStyle,
				blueprint,
				rundown,
				playingPartInstance,
				currentPartInstance
			)

			clearNextSegmentId(cache, currentPartInstance)
			resetPreviousSegment(cache)

			// Update the next partinstance
			const nextPart = selectNextPart(
				context,
				playlist,
				playingPartInstance,
				null,
				getOrderedSegmentsAndPartsFromPlayoutCache(cache)
			)
			await setNextPart(context, cache, nextPart)

			// complete the take
			await afterTake(context, cache, playingPartInstance)
		} else {
			// a part is being played that has not been selected for playback by Core

			// I am pretty sure this is path is dead, I dont see how we could ever get here (in a way that we can recover from)
			// If it is confirmed to be used, then perhaps we can do something better than this,
			// but I dont think we can until we know what we are trying to solve

			// 1) We could hit this if we remove the auto-nexted part and playout-gateway gets the new timeline too late.
			//    We can't magically fix that, as the instance will no longer exist
			// 2) Maybe some other edge cases around deleting partInstances (perhaps when doing a reset?).
			//    Not much we can do about this though

			const previousReported = playlist.lastIncorrectPartPlaybackReported
			if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
				// first time this has happened for a while, let's make sure it has the correct timeline
				await updateTimeline(context, cache)
			}

			logger.error(
				`PartInstance "${playingPartInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`
			)
		}
	}
}

/**
 * Set the playback of a part is confirmed to have stopped
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param data Details on the part stop event
 */
export function onPartPlaybackStopped(
	context: JobContext,
	cache: CacheForPlayout,
	data: {
		partInstanceId: PartInstanceId
		stoppedPlayback: Time
	}
): void {
	const playlist = cache.Playlist.doc

	const partInstance = cache.PartInstances.findOne(data.partInstanceId)
	if (partInstance) {
		// make sure we don't run multiple times, even if TSR calls us multiple times

		const isPlaying =
			partInstance.timings?.reportedStartedPlayback && !partInstance.timings?.reportedStoppedPlayback
		if (isPlaying) {
			logger.debug(
				`onPartPlaybackStopped: Playout reports PartInstance "${
					data.partInstanceId
				}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
			)

			reportPartInstanceHasStopped(context, cache, partInstance, data.stoppedPlayback)
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPartPlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else if (getCurrentTime() - (playlist.resetTime ?? 0) > RESET_IGNORE_ERRORS) {
		// Ignore errors that happen just after a reset, so do nothing here.
	} else {
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}
}

/**
 * Set the playback of a PartInstance is confirmed to have started
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param partInstance PartInstance to be updated
 * @param timestamp timestamp the PieceInstance started
 */
export function reportPartInstanceHasStarted(
	context: JobContext,
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	timestamp: Time
): void {
	if (partInstance) {
		let timestampUpdated = false
		cache.PartInstances.updateOne(partInstance._id, (instance) => {
			if (!instance.timings) instance.timings = {}

			// If timings.startedPlayback has already been set, we shouldn't set it to another value:
			if (!instance.timings.reportedStartedPlayback) {
				timestampUpdated = true
				instance.timings.reportedStartedPlayback = timestamp

				if (!cache.isMultiGatewayMode) {
					instance.timings.plannedStartedPlayback = timestamp
				}
			}

			// Unset stoppedPlayback if it is set:
			if (instance.timings.reportedStoppedPlayback || instance.timings.duration) {
				timestampUpdated = true
				delete instance.timings.reportedStoppedPlayback
				delete instance.timings.duration

				if (!cache.isMultiGatewayMode) {
					delete instance.timings.plannedStoppedPlayback
				}
			}

			// Save/discard change
			return timestampUpdated ? instance : false
		})

		if (timestampUpdated && !cache.isMultiGatewayMode && cache.Playlist.doc.previousPartInfo) {
			// Ensure the plannedStoppedPlayback is set for the previous partinstance too
			cache.PartInstances.updateOne(cache.Playlist.doc.previousPartInfo.partInstanceId, (instance) => {
				if (instance.timings && !instance.timings.plannedStoppedPlayback) {
					instance.timings.plannedStoppedPlayback = timestamp
					return instance
				}

				return false
			})
		}

		// Update the playlist:
		cache.Playlist.update((playlist) => {
			if (!playlist.rundownsStartedPlayback) {
				playlist.rundownsStartedPlayback = {}
			}

			// If the partInstance is "untimed", it will not update the playlist's startedPlayback and will not count time in the GUI:
			if (!partInstance.part.untimed) {
				const rundownId = unprotectString(partInstance.rundownId)
				if (!playlist.rundownsStartedPlayback[rundownId]) {
					playlist.rundownsStartedPlayback[rundownId] = timestamp
				}

				if (!playlist.startedPlayback) {
					playlist.startedPlayback = timestamp
				}
			}

			return playlist
		})

		if (timestampUpdated) {
			cache.deferAfterSave(() => {
				// Run in the background, we don't want to hold onto the lock to do this
				queuePartInstanceTimingEvent(context, cache.PlaylistId, partInstance._id)
			})
		}
	}
}

/**
 * Set the playback of a PartInstance is confirmed to have stopped
 * @param context Context from the job queue
 * @param cache DB cache for the current playlist
 * @param partInstance PartInstance to be updated
 * @param timestamp timestamp the PieceInstance stopped
 */
export function reportPartInstanceHasStopped(
	context: JobContext,
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	timestamp: Time
): void {
	let timestampUpdated = false
	if (!partInstance.timings?.reportedStoppedPlayback) {
		cache.PartInstances.updateOne(partInstance._id, (instance) => {
			if (!instance.timings) instance.timings = {}
			instance.timings.reportedStoppedPlayback = timestamp
			instance.timings.duration = timestamp - (instance.timings.reportedStartedPlayback || timestamp)

			if (!cache.isMultiGatewayMode) {
				instance.timings.plannedStoppedPlayback = timestamp
			}

			return instance
		})
		timestampUpdated = true
	}

	if (timestampUpdated) {
		cache.deferAfterSave(() => {
			// Run in the background, we don't want to hold onto the lock to do this
			queuePartInstanceTimingEvent(context, cache.PlaylistId, partInstance._id)
		})
	}
}
