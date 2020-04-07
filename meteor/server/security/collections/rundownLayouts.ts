import { RundownLayouts, RundownLayout } from '../../../lib/collections/RundownLayouts'
import { rejectFields } from './lib'

export namespace RundownLayoutSecurity {
	export function allowReadAccess (selector: object, token: string, context: any) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess (id: string) {
		// TODO

		return true
	}
}
// Setup rules:

RundownLayouts.allow({
	insert (userId: string, doc: RundownLayout): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return rejectFields(fields, [
			'_id'
		])
	},
	remove (userId, doc) {
		return false
	}
})
