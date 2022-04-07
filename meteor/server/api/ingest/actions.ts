import { getPeripheralDeviceFromRundown } from './lib'
import { MOSDeviceActions } from './mosDevice/actions'
import { Meteor } from 'meteor/meteor'
import { Rundown } from '../../../lib/collections/Rundowns'
import { TriggerReloadDataResponse } from '../../../lib/api/userActions'
import { GenericDeviceActions } from './genericDevice/actions'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

/*
This file contains actions that can be performed on an ingest-device
*/
export namespace IngestActions {
	/**
	 * Trigger a reload of a rundown
	 */
	export async function reloadRundown(rundown: Rundown): Promise<TriggerReloadDataResponse> {
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
}
