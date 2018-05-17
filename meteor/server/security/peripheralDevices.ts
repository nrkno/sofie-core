import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'

export namespace PeripheralDeviceSecurity {

	export function getPeripheralDevice (id: string, token: string, context: any): PeripheralDevice {

		if (!id) throw new Meteor.Error(400,'id missing!')
		if (!token) throw new Meteor.Error(400,'token missing!')
		check(id, String)
		check(token, String)

		let peripheralDevice = PeripheralDevices.findOne(id)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + id + '" not found' )
		// if (!peripheralDevice) return null

		if (peripheralDevice.token === token) return peripheralDevice

		throw new Meteor.Error(401,'Not allowed access to peripheralDevice')
	}
	export function allowReadAccess (selector: object, token: string, context) {

		if (selector['_id'] && token) {

			check(selector['_id'], String)

			PeripheralDeviceSecurity.getPeripheralDevice(selector['_id'], token, this)

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
		return true // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Temporary: allow all updates client-side
		// return false // Not allowed client-side
	},

	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
