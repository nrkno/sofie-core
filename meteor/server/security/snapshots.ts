import { Meteor } from 'meteor/meteor'
import { Snapshots, SnapshotItem } from '../../lib/collections/Snapshots'

// Setup rules:
Snapshots.allow({
	insert (userId: string, doc: SnapshotItem): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
