import { Studio, Studios } from '../../lib/collections/Studios'
import { rejectFields } from './lib'

export namespace StudiosSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}
// Setup rules:

// Setup rules:
Studios.allow({
	insert(userId: string, doc: Studio): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return rejectFields(fields, ['_id'])
	},
	remove(userId, doc) {
		return false
	},
})
