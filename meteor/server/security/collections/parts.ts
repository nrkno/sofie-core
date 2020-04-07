import { Parts, Part, DBPart } from '../../../lib/collections/Parts'

// Setup rules:
Parts.allow({
	insert (userId: string, doc: Part): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
