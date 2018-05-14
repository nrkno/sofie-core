import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'

import { RuntimeFunctions, RuntimeFunction } from '../../lib/collections/RuntimeFunctions'

export namespace RuntimeFunctionsSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}

RuntimeFunctions.allow({
	insert (userId: string, doc: RuntimeFunction): boolean {
		return true // Temporary: allow all updates client-side
	},
	update (userId, doc, fields, modifier) {
		return true // Temporary: allow all updates client-side
	},

	remove (userId, doc) {
		return true // Temporary: allow all updates client-side
	}
})
