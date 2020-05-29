import { Rundowns, Rundown } from '../../lib/collections/Rundowns'

export namespace RundownSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}
// Setup rules:

Rundowns.allow({
	insert(userId: string, doc: Rundown): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		// return true // tmp!
		return false
	},
	remove(userId, doc) {
		return false
	},
})
