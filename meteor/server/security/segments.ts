import { Meteor } from 'meteor/meteor'
import { Segments, Segment } from '../../lib/collections/Segments'

// Setup rules:
Segments.allow({
	insert (userId: string, doc: Segment): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
