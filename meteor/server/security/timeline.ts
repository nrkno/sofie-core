import { Meteor } from 'meteor/meteor'
import { Timeline, TimelineObj } from '../../lib/collections/Timeline'

export namespace TimelineSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

// Setup rules:
Timeline.allow({
	insert (userId: string, doc: TimelineObj): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
