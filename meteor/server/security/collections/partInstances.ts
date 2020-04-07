import { PartInstances, PartInstance } from '../../../lib/collections/PartInstances'

// Setup rules:
PartInstances.allow({
	insert (userId: string, doc: PartInstance): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
