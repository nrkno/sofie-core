import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { PeripheralDevice, PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { rejectFields } from './lib'
import { Mongo } from 'meteor/mongo'
import { protectString } from '../../lib/lib'

export namespace PeripheralDeviceSecurity {

	export function getPeripheralDevice (deviceId: PeripheralDeviceId, token: string, context: any): PeripheralDevice {
		context = context || {}
		if (!deviceId) throw new Meteor.Error(400,'id missing!')
		check(deviceId, String)

		if (! (context || {}).userId) {
			if (!token) throw new Meteor.Error(400,'token missing!')
			check(token, String)
		}

		let peripheralDevice = PeripheralDevices.findOne(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + deviceId + '" not found')
		// if (!peripheralDevice) return null

		if (peripheralDevice.token === token) return peripheralDevice

		/*if (context.userId) {
			check(context.userId, String)
			let user = Meteor.users.findOne(context.userId)
			if (user) {
				// TODO: add user access check here, when accounts have been implemented
				return peripheralDevice
			}
		}*/

		throw new Meteor.Error(401,'Not allowed access to peripheralDevice')
	}
	export function allowReadAccess (selector: Mongo.Query<PeripheralDevice>, token: string, context: any) {
		if (selector._id && token) {

			check(selector['_id'], String)
			selector._id = protectString(selector._id + '')

			getPeripheralDevice(selector._id, token, context)

			return true
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

PeripheralDevices.allow({
	insert (userId: string, doc: PeripheralDevice): boolean {
		return true
	},
	update (userId, doc, fields, modifier) {
		return rejectFields(fields, [
			'type',
			'parentDeviceId',
			'versions',
			'expectedVersions',
			'created',
			'status',
			'lastSeen',
			'lastConnected',
			'connected',
			'connectionId',
			'token',
			// 'settings' is allowed
		])
	},

	remove (userId, doc) {
		return false
	}
})
