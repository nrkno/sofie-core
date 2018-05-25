import { Meteor } from 'meteor/meteor'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'

// Setup rules:
SegmentLineAdLibItems.allow({
	insert(userId: string, doc: SegmentLineAdLibItem): boolean {
		return true // TODO: Not allowed client-side
	},
	update(userId, doc, fields, modifier) {
		return true // TODO: Not allowed client-side
	},
	remove(userId, doc) {
		return true // TODO: Not allowed client-side
	}
})
