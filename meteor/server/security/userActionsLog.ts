import { Meteor } from 'meteor/meteor'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'

export namespace UserActionsLogSecurity {
	export function allowReadAccess (selector: object, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

// Setup rules:
UserActionsLog.allow({
	insert (userId: string, doc: UserActionsLogItem): boolean {
		return true // Tmp: Allow everything client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Tmp: Allow everything client-side
	},
	remove (userId, doc) {
		return true // Tmp: Allow everything client-side
	}
})
