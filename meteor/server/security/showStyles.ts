import { Meteor } from 'meteor/meteor'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'

export namespace ShowStylesSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

// Setup rules:
ShowStyles.allow({
	insert (userId: string, doc: ShowStyle): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
