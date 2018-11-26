import { RecordedFiles, RecordedFile } from '../../lib/collections/RecordedFiles'

export namespace RecordedFileSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

RecordedFiles.allow({
	insert (userId: string, doc: RecordedFile): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		// return true // tmp!
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
