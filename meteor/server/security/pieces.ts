import { SegmentLineItems, SegmentLineItem } from '../../lib/collections/SegmentLineItems'

// Setup rules:
SegmentLineItems.allow({
	insert (userId: string, doc: SegmentLineItem): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
