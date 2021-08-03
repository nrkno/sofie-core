import { getPeripheralDeviceFromRundown, runIngestOperation } from './lib'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { check } from '../../../lib/check'
import { logger } from '../../logging'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { Segment } from '../../../lib/collections/Segments'
import { GenericDeviceActions } from './genericDevice/actions'
import { runPlayoutOperationWithLock, PlayoutLockFunctionPriority } from '../playout/lockFunction'
import { removeRundownsFromDb } from '../rundownPlaylist'
import { VerifiedRundownPlaylistContentAccess } from '../lib'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueStudioJob } from '../../worker/worker'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'

/*
This file contains actions that can be performed on an ingest-device (MOS-device)
*/
export namespace IngestActions {
	/**
	 * Trigger a reload of a rundown
	 */
	export function reloadRundown(rundown: Rundown): TriggerReloadDataResponse {
		const device = getPeripheralDeviceFromRundown(rundown)

		// TODO: refacor this into something nicer perhaps?
		if (device.type === PeripheralDeviceType.MOS) {
			return MOSDeviceActions.reloadRundown(device, rundown)
		} else if (device.type === PeripheralDeviceType.SPREADSHEET) {
			return GenericDeviceActions.reloadRundown(device, rundown)
		} else if (device.type === PeripheralDeviceType.INEWS) {
			return GenericDeviceActions.reloadRundown(device, rundown)
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not support the method "reloadRundown"`)
		}
	}

	export function reloadSegment(rundown: Rundown, segment: Segment): TriggerReloadDataResponse {
		const device = getPeripheralDeviceFromRundown(rundown)

		if (device.type === PeripheralDeviceType.MOS) {
			// MOS doesn't support reloading a segment, so do the whole rundown
			return MOSDeviceActions.reloadRundown(device, rundown)
		} else if (device.type === PeripheralDeviceType.INEWS) {
			return GenericDeviceActions.reloadSegment(device, rundown, segment)
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not support the method "reloadRundown"`)
		}
	}

	/**
	 * Notify the device on what part is currently playing
	 * @param rundown
	 * @param currentPlayingPart
	 */
	export function notifyCurrentPlayingPart(rundown: Rundown, currentPlayingPart: Part | null) {
		if (!rundown.peripheralDeviceId) {
			logger.warn(`Rundown "${rundown._id} has no peripheralDevice. Skipping notifyCurrentPlayingPart`)
			return
		}
		const device = getPeripheralDeviceFromRundown(rundown)
		const playlist = RundownPlaylists.findOne(rundown.playlistId)

		if (!playlist) throw new Meteor.Error(501, `Orphaned rundown: "${rundown._id}"`)
		if (playlist.rehearsal) currentPlayingPart = null

		const currentPlayingPartExternalId: string | null = currentPlayingPart ? currentPlayingPart.externalId : null
		if (currentPlayingPartExternalId) {
			Rundowns.update(this._id, {
				$set: {
					notifiedCurrentPlayingPartExternalId: currentPlayingPartExternalId,
				},
			})
			rundown.notifiedCurrentPlayingPartExternalId = currentPlayingPartExternalId
		} else {
			Rundowns.update(this._id, {
				$unset: {
					currentPlayingStoryStatus: 1,
				},
			})
			delete rundown.notifiedCurrentPlayingPartExternalId
		}

		if (
			device.category === PeripheralDeviceCategory.INGEST &&
			device.type === PeripheralDeviceType.MOS // TODO: refacor this into something nicer perhaps?
		) {
			MOSDeviceActions.notifyCurrentPlayingPart(
				device,
				rundown,
				rundown.notifiedCurrentPlayingPartExternalId || null,
				currentPlayingPartExternalId
			)
		}
	}
	/**
	 * Run the cached data through blueprints in order to re-generate the Rundown
	 */
	export function regenerateRundownPlaylist(
		access: VerifiedRundownPlaylistContentAccess | null,
		rundownPlaylistId: RundownPlaylistId,
		purgeExisting?: boolean
	) {
		check(rundownPlaylistId, String)

		const ingestData = waitForPromise(
			runPlayoutOperationWithLock(
				access,
				'regenerateRundownPlaylist',
				rundownPlaylistId,
				PlayoutLockFunctionPriority.MISC,
				async () => {
					const rundownPlaylist = RundownPlaylists.findOne(rundownPlaylistId)
					if (!rundownPlaylist)
						throw new Meteor.Error(404, `Rundown Playlist "${rundownPlaylistId}" not found`)

					const studio = rundownPlaylist.getStudio()
					if (!studio) {
						throw new Meteor.Error(
							404,
							`Studios "${rundownPlaylist.studioId}" was not found for Rundown Playlist "${rundownPlaylist._id}"`
						)
					}

					logger.info(`Regenerating rundown playlist ${rundownPlaylist.name} (${rundownPlaylist._id})`)

					const rundowns = Rundowns.find({ playlistId: rundownPlaylistId }).fetch()
					if (rundowns.length === 0) return []

					// Cleanup old state
					if (purgeExisting) {
						await removeRundownsFromDb(rundowns.map((r) => r._id))
					} else {
						const job = await QueueStudioJob(StudioJobs.ResetRundownPlaylist, rundownPlaylist.studioId, {
							playlistId: rundownPlaylist._id,
						})
						await job.complete
					}

					// exit the sync function, so the cache is written back
					return rundowns.map((rundown) => ({
						rundownExternalId: rundown.externalId,
						studio,
					}))
				}
			)
		)

		// Fire off all the updates in parallel, in their own low-priority tasks
		waitForPromiseAll(
			ingestData.map(async ({ rundownExternalId, studio }) =>
				runIngestOperation(studio._id, IngestJobs.RegenerateRundown, {
					rundownExternalId: rundownExternalId,
					peripheralDeviceId: null,
				})
			)
		)
	}
}
