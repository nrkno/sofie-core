import { getPeripheralDeviceFromRundown, rundownIngestSyncFromStudioFunction } from './lib'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { check } from '../../../lib/check'
import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { loadCachedRundownData } from './ingestCache'
import { resetRundownPlaylist } from '../playout/lib'
import { prepareUpdateRundownInner, savePreparedRundownChanges } from './rundownInput'
import { logger } from '../../logging'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { waitForPromise, waitForPromiseAll, makePromise } from '../../../lib/lib'
import { Segment } from '../../../lib/collections/Segments'
import { GenericDeviceActions } from './genericDevice/actions'
import { MethodContext } from '../../../lib/api/methods'
import { rundownPlaylistPlayoutSyncFunction } from '../playout/playout'

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
		if (device.type === PeripheralDeviceAPI.DeviceType.MOS) {
			return MOSDeviceActions.reloadRundown(device, rundown)
		} else if (device.type === PeripheralDeviceAPI.DeviceType.SPREADSHEET) {
			return GenericDeviceActions.reloadRundown(device, rundown)
		} else if (device.type === PeripheralDeviceAPI.DeviceType.INEWS) {
			return GenericDeviceActions.reloadRundown(device, rundown)
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not support the method "reloadRundown"`)
		}
	}

	export function reloadSegment(rundown: Rundown, segment: Segment): TriggerReloadDataResponse {
		const device = getPeripheralDeviceFromRundown(rundown)

		if (device.type === PeripheralDeviceAPI.DeviceType.MOS) {
			return reloadRundown(rundown)
		} else if (device.type === PeripheralDeviceAPI.DeviceType.INEWS) {
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
			device.category === PeripheralDeviceAPI.DeviceCategory.INGEST &&
			device.type === PeripheralDeviceAPI.DeviceType.MOS // TODO: refacor this into something nicer perhaps?
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
		context: MethodContext | null,
		rundownPlaylistId: RundownPlaylistId,
		purgeExisting?: boolean
	) {
		check(rundownPlaylistId, String)

		return rundownPlaylistPlayoutSyncFunction(
			context,
			'regenerateRundownPlaylist',
			rundownPlaylistId,
			(playlistCache) => {
				const playlist = playlistCache.Playlist.doc
				logger.info(`Regenerating rundown playlist ${playlist.name} (${playlist._id})`)

				const rundowns = playlistCache.Rundowns.findFetch()

				waitForPromiseAll(
					rundowns.map((rundown) =>
						makePromise(() => {
							if (rundown.studioId !== playlist.studioId) {
								logger.warning(
									`Rundown "${rundown._id}" does not belong to the same studio as its playlist "${playlist._id}"`
								)
							}

							return rundownIngestSyncFromStudioFunction(
								'regenerateRundownPlaylist',
								rundown.studioId,
								rundown.externalId,
								(cache, ingestDataCache) => {
									const ingestRundown = loadCachedRundownData(
										ingestDataCache,
										rundown._id,
										rundown.externalId
									)
									if (purgeExisting) {
										removeRundownFromCache(cache, rundown)
									}

									return prepareUpdateRundownInner(cache, ingestDataCache, ingestRundown, undefined)
								},
								(cache, playoutInfo, preparedChanges) => {
									if (preparedChanges) {
										savePreparedRundownChanges(cache, playoutInfo, preparedChanges)
									}
								},
								{ skipPlaylistLock: true }
							)
						})
					)
				)
			},
			(cache) => {
				// Ensure the playlist is clean
				resetRundownPlaylist(cache)
			}
		)
	}
}
