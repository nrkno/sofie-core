import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { rejectFields } from './lib'
import { PeripheralDeviceSecurity } from './peripheralDevices';

export namespace ExpectedMediaItemsSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {

		if (selector['_id'] && token) {

			check(selector['_id'], String)

			PeripheralDeviceSecurity.getPeripheralDevice(selector['_id'], token, context)

			return true
		} else {

			// TODO: implement access logic here
			// use context.userId

			// just returning true for now
			return true
		}
	}
	export function allowWriteAccess() {
		// TODO
	}
}
// Setup rules:

ExpectedMediaItems.allow({
	insert(userId: string, doc: ExpectedMediaItem): boolean {
		return false
	},

	update(userId, doc, fields, modifier) {
		return false
	},

	remove(userId, doc) {
		return false
	}
})
