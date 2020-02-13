import * as _ from 'underscore'
import { getPeripheralDeviceFromRundown } from './lib'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { Part } from '../../../lib/collections/Parts'
import { check } from 'meteor/check'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { loadCachedRundownData } from './ingestCache'
import { resetRundown } from '../playout/lib'
import { handleUpdatedRundownForStudio, handleUpdatedSegment } from './rundownInput'
import { logger } from '../../logging'
import { Studios } from '../../../lib/collections/Studios'
import { UserActionAPI } from '../../../lib/api/userActions'
import { Segment } from '../../../lib/collections/Segments'
import { WrapAsyncCallback } from '../../../lib/lib'
import { IngestSegment } from 'tv-automation-sofie-blueprints-integration'
import { GenericDeviceActions } from './genericDevice/actions'

/*
This file contains actions that can be performed on an ingest-device
*/
export namespace IngestActions {
	/**
	 * Trigger a reload of a rundown
	 */
	export function reloadRundown (rundown: Rundown): UserActionAPI.TriggerReloadDataResponse {
		const device = getPeripheralDeviceFromRundown(rundown)

		// TODO: refacor this into something nicer perhaps?
		if (device.type === PeripheralDeviceAPI.DeviceType.MOS) {
			return MOSDeviceActions.reloadRundown(device, rundown)
		} else if (
			device.type === PeripheralDeviceAPI.DeviceType.INEWS
			// device.type === PeripheralDeviceAPI.DeviceType.SPREADSHEET
		) {
			return GenericDeviceActions.reloadRundown(device, rundown)
		} else {
			throw new Meteor.Error(400, `The device ${device._id} does not support the method "reloadRundown"`)
		}

	}
	/**
	 * Trigger a reload of a single Segment
	 */
	export function reloadSegment (rundown: Rundown, segment: Segment): UserActionAPI.TriggerReloadDataResponse {
		const device = getPeripheralDeviceFromRundown(rundown)

		if (device.type === PeripheralDeviceAPI.DeviceType.MOS) {
			throw new Meteor.Error(400, `The device ${device._id} uses MOS, and it does not support the method "reloadSegment"`)
		} else if (
			device.type === PeripheralDeviceAPI.DeviceType.INEWS ||
			device.type === PeripheralDeviceAPI.DeviceType.SPREADSHEET
		) {
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
	export function regenerateRundown (rundownId: string, purgeExisting?: boolean) {
		check(rundownId, String)

		const rundown = Rundowns.findOne(rundownId)
		if (!rundown) {
			throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)
		}

		logger.info(`Regenerating rundown ${rundown.name} (${rundown._id})`)

		const peripheralDevice = PeripheralDevices.findOne(
			rundown.peripheralDeviceId
		)
		if (!peripheralDevice) {
			logger.info(`Rundown has no valid PeripheralDevices. Running without`)
		}
		const studio = Studios.findOne(rundown.studioId)
		if (!studio) {
			throw new Meteor.Error(404,`Studios "${rundown.studioId}" was not found for rundown "${rundown._id}"`)
		}

		const ingestRundown = loadCachedRundownData(rundownId, rundown.externalId)
		if (purgeExisting) {
			rundown.remove()
		} else {
			// Reset the rundown (remove adlibs, etc):
			resetRundown(rundown)
		}

		handleUpdatedRundownForStudio(studio, peripheralDevice, ingestRundown, rundown.dataSource)
	}
}
