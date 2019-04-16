import { getRundown, getPeripheralDeviceFromRundown } from './lib'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'

/*
This file contains actions that can be performed on an ingest-device (MOS-device)
*/
export namespace IngestActions {

	/**
	 * Trigger a reload of a rundown
	 */
	export function reloadRundown (rundown: Rundown) {
		const device = getPeripheralDeviceFromRundown(rundown)

		// TODO: refacor this into something nicer perhaps?
		if (device.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE ) {
			MOSDeviceActions.reloadRundown(device, rundown)
		// } else if (device.type === PeripheralDeviceAPI.DeviceType.SPREADSHEET ) {
			// TODO
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not suport the method "reloadRundown"`)
		}

	}
	/**
	 * Notify the device on what part is currentöy playing
	 * @param rundown
	 * @param currentPlayingPart
	 */
	export function notifyCurrentPlayingPart (rundown: Rundown, currentPlayingPart: Part | null) {
		const device = getPeripheralDeviceFromRundown(rundown)

		if (rundown.rehearsal) currentPlayingPart = null

		const currentPlayingPartExternalId: string | null = (
			currentPlayingPart ?
			currentPlayingPart.externalId :
			null
		)
		if (currentPlayingPartExternalId) {
			Rundowns.update(this._id, {$set: {
				notifiedCurrentPlayingPartExternalId: currentPlayingPartExternalId
			}})
			rundown.notifiedCurrentPlayingPartExternalId = currentPlayingPartExternalId
		} else {
			Rundowns.update(this._id, {$unset: {
				currentPlayingStoryStatus: 1
			}})
			delete rundown.notifiedCurrentPlayingPartExternalId
		}

		// TODO: refacor this into something nicer perhaps?
		if (device.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE ) {
			MOSDeviceActions.notifyCurrentPlayingPart(device, rundown, rundown.notifiedCurrentPlayingPartExternalId || null, currentPlayingPartExternalId)
		// } else if (device.type === PeripheralDeviceAPI.DeviceType.SPREADSHEET ) {
			// TODO
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not suport the method "notifyCurrentPlayingPart"`)
		}

	}
}
