import { Meteor } from 'meteor/meteor'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'

export namespace BlueprintsSecurity {
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
Blueprints.allow({
	insert (userId: string, doc: Blueprint): boolean {
		return true // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Not allowed client-side
	},
	remove (userId, doc) {
		return true // Not allowed client-side
	}
})
