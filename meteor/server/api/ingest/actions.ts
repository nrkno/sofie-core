import { getPeripheralDeviceFromRundown } from './lib'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { logger } from '../../logging'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { Segment } from '../../../lib/collections/Segments'
import { GenericDeviceActions } from './genericDevice/actions'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

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
}
