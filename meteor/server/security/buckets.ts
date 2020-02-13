import { rejectFields } from './lib'
import { Buckets, Bucket } from '../../lib/collections/Buckets'

export namespace BucketSecurity {
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

Buckets.allow({
	insert (userId: string, doc: Bucket): boolean {
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
