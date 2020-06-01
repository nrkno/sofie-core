import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { rejectFields } from './lib'

export namespace ShowStyleBasesSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}

// Setup rules:
ShowStyleBases.allow({
	insert(userId: string, doc: ShowStyleBase): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return rejectFields(fields, ['_id'])
	},
	remove(userId, doc) {
		return false
	},
})
