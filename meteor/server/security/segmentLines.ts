import { Meteor } from 'meteor/meteor'
import { SegmentLines, SegmentLine } from '../../lib/collections/SegmentLines'

// Setup rules:
SegmentLines.allow({
	insert (userId: string, doc: SegmentLine): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
