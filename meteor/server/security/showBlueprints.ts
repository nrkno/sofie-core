import { Meteor } from 'meteor/meteor'
import { ShowBlueprints, ShowBlueprint } from '../../lib/collections/ShowBlueprints'

export namespace ShowBlueprintsSecurity {
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
ShowBlueprints.allow({
	insert (userId: string, doc: ShowBlueprint): boolean {
		return true // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Not allowed client-side
	},
	remove (userId, doc) {
		return true // Not allowed client-side
	}
})
