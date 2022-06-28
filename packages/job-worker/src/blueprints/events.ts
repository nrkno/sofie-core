import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CacheForPlayout } from '../playout/cache'
import { Time } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { JobContext } from '../jobs'
import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../logging'
import * as debounceFn from 'debounce-fn'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'

const EVENT_WAIT_TIME = 500

const partInstanceTimingDebounceFunctions = new Map<string, debounceFn.DebouncedFunction<[], void>>()

function handlePartInstanceTimingEvent(
	context: JobContext,
	playlistId: RundownPlaylistId,
	partInstanceId: PartInstanceId
): void {
	// Future: this should be workqueue backed, not in-memory

	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() it is likely for there to be a bunch of started and stopped events coming in at the same time
	// These blueprint methods are not time critical (meaning they do raw db operations), and can be easily delayed
	const funcId = `${playlistId}_${partInstanceId}`
	const cachedFunc = partInstanceTimingDebounceFunctions.get(funcId)
	if (cachedFunc) {
		cachedFunc()
	} else {
		const newFunc = debounceFn(
			() => {
				context
					.queueEventJob(EventsJobs.PartInstanceTimings, {
						playlistId,
						partInstanceId,
					})
					.catch((e) => {
						logger.error(
							`Failed to queue job in handlePartInstanceTimingEvent "${funcId}": "${stringifyError(e)}"`
						)
					})
			},
			{
				before: false,
				after: true,
				wait: EVENT_WAIT_TIME,
			}
		)
		partInstanceTimingDebounceFunctions.set(funcId, newFunc)
		newFunc()
	}
}

export function reportPartInstanceHasStarted(
	context: JobContext,
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	timestamp: Time
): void {
	if (partInstance) {
		let timestampUpdated = false
		cache.PartInstances.update(partInstance._id, (instance) => {
			if (!instance.timings) instance.timings = {}

			// If timings.startedPlayback has already been set, we shouldn't set it to another value:
			if (!instance.timings.reportedStartedPlayback) {
				timestampUpdated = true
				instance.timings.reportedStartedPlayback = timestamp

				if (cache.isMultiGatewayMode) {
					instance.timings.plannedStartedPlayback = timestamp
				}
			}

			// Unset stoppedPlayback if it is set:
			if (instance.timings.reportedStoppedPlayback) {
				timestampUpdated = true
				delete instance.timings.reportedStoppedPlayback

				if (cache.isMultiGatewayMode) {
					delete instance.timings.plannedStoppedPlayback
				}
			}

			// Save/discard change
			return timestampUpdated ? instance : false
		})

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
				handlePartInstanceTimingEvent(context, cache.PlaylistId, partInstance._id)
			})
		}
	}
}
export function reportPartInstanceHasStopped(
	context: JobContext,
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	timestamp: Time
): void {
	let timestampUpdated = false
	if (!partInstance.timings?.reportedStoppedPlayback) {
		cache.PartInstances.update(partInstance._id, (instance) => {
			if (!instance.timings) instance.timings = {}
			instance.timings.reportedStoppedPlayback = timestamp

			if (cache.isMultiGatewayMode) {
				instance.timings.plannedStoppedPlayback = timestamp
			}

			return instance
		})
		timestampUpdated = true
	}

	if (timestampUpdated) {
		cache.deferAfterSave(() => {
			// Run in the background, we don't want to hold onto the lock to do this
			handlePartInstanceTimingEvent(context, cache.PlaylistId, partInstance._id)
		})
	}
}

export async function reportPieceHasStarted(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	pieceInstance: Pick<PieceInstance, '_id' | 'partInstanceId' | 'infinite'>,
	timestamp: Time
): Promise<void> {
	await Promise.all([
		context.directCollections.PieceInstances.update(pieceInstance._id, {
			$set: {
				reportedStartedPlayback: timestamp,
			},
			$unset: {
				reportedStoppedPlayback: 1,
			},
		}),

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		pieceInstance.infinite && playlist?.nextPartInstanceId
			? context.directCollections.PieceInstances.update(
					{
						partInstanceId: playlist.nextPartInstanceId,
						'infinite.infiniteInstanceId': pieceInstance.infinite.infiniteInstanceId,
					},
					{
						$set: {
							reportedStartedPlayback: timestamp,
						},
						$unset: {
							reportedStoppedPlayback: 1,
						},
					}
			  )
			: null,
	])

	handlePartInstanceTimingEvent(context, playlist._id, pieceInstance.partInstanceId)
}
export async function reportPieceHasStopped(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	pieceInstance: Pick<PieceInstance, '_id' | 'partInstanceId'>,
	timestamp: Time
): Promise<void> {
	await context.directCollections.PieceInstances.update(pieceInstance._id, {
		$set: {
			reportedStoppedPlayback: timestamp,
		},
	})

	handlePartInstanceTimingEvent(context, playlist._id, pieceInstance.partInstanceId)
}
