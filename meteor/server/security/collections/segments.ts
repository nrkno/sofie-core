import { Segments, Segment } from '../../../lib/collections/Segments'

// Setup rules:
Segments.allow({
	insert (userId: string, doc: Segment): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
