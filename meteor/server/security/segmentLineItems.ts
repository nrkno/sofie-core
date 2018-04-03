import { Meteor } from 'meteor/meteor'
import { SegmentLineItems, SegmentLineItem } from '../../lib/collections/SegmentLineItems'

// Setup rules:
SegmentLineItems.allow({
	insert (userId: string, doc: SegmentLineItem): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
