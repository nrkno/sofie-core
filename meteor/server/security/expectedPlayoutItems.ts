import { check } from 'meteor/check'

import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, getStudioIdFromDevice } from '../../lib/collections/PeripheralDevices'

import { MongoSelector } from '../../lib/typings/meteor'

export namespace ExpectedPlayoutItemsSecurity {
	export function allowReadAccess (selector: MongoSelector<ExpectedPlayoutItem> | any, token: string, context: any) {
		check(selector, Object)
		check(selector.studioId, String)

		let playoutDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			token: token
		})
		if (!playoutDevice) return false

		playoutDevice.studioId = getStudioIdFromDevice(playoutDevice)

		if (playoutDevice && token) {
			return playoutDevice
		} else {
			// TODO: implement access logic here
			// just returning true for now
			return true
		}
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

ExpectedPlayoutItems.allow({
	insert (userId: string, doc: ExpectedPlayoutItem): boolean {
		return false
	},

	update (userId, doc, fields, modifier) {
		return false
	},

	remove (userId, doc) {
		return false
	}
})
