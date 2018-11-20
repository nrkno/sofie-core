import { Meteor } from 'meteor/meteor'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'

export namespace ShowStyleBasesSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

// Setup rules:
ShowStyleBases.allow({
	insert (userId: string, doc: ShowStyleBase): boolean {
		return true
	},
	update (userId, doc, fields, modifier) {
		return true
	},
	remove (userId, doc) {
		return true
	}
})
