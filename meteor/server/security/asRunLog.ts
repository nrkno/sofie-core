import { Meteor } from 'meteor/meteor'
import { AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'

export namespace AsRunLogSecurity {
	export function allowReadAccess (selector: object, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

// Setup rules:
AsRunLog.allow({
	insert (userId: string, doc: AsRunLogEvent): boolean {
		return false // not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // not allowed client-side
	},
	remove (userId, doc) {
		return false // not allowed client-side
	}
})
