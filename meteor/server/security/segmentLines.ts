import { Meteor } from 'meteor/meteor'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'

// Setup rules:
SegmentLines.allow({
	insert (userId: string, doc: SegmentLine): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
