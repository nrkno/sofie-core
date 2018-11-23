import { Meteor } from 'meteor/meteor'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'

// Setup rules:
SegmentLineAdLibItems.allow({
	insert (userId: string, doc: SegmentLineAdLibItem): boolean {
		return true // TODO: Decide rules
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove (userId, doc) {
		return true // TODO: Decide rules
	}
})
