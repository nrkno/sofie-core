import { Snapshots, SnapshotItem } from '../../../lib/collections/Snapshots'

// Setup rules:
Snapshots.allow({
	insert (userId: string, doc: SnapshotItem): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		if (fields.length === 1 && fields[0] === 'comment') return true
		return false
	},
	remove (userId, doc) {
		return false
	}
})
