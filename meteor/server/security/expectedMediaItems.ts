import { check } from 'meteor/check'

import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, getStudioIdFromDevice } from '../../lib/collections/PeripheralDevices'

import { MongoSelector } from '../../lib/typings/meteor'

export namespace ExpectedMediaItemsSecurity {
	export function allowReadAccess (selector: MongoSelector<ExpectedMediaItem> | any, token: string, context: any) {
		check(selector, Object)
		if (selector.mediaFlowId) {
			check(selector.mediaFlowId, Object)
			check(selector.mediaFlowId.$in, Array)
		}

		// let mediaFlowIds: string[] = selector.mediaFlowId.$in

		let mediaManagerDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
			token: token
		})

		if (!mediaManagerDevice) return false

		mediaManagerDevice.studioId = getStudioIdFromDevice(mediaManagerDevice)

		if (mediaManagerDevice && token) {

			// mediaManagerDevice.settings

			return mediaManagerDevice
		} else {

			// TODO: implement access logic here
			// use context.userId

			// just returning true for now
			return true
		}
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

ExpectedMediaItems.allow({
	insert (userId: string, doc: ExpectedMediaItem): boolean {
		return false
	},

	update (userId, doc, fields, modifier) {
		return false
	},

	remove (userId, doc) {
		return false
	}
})
