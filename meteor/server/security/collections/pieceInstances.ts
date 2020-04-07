import { PieceInstances, PieceInstance } from '../../../lib/collections/PieceInstances'

// Setup rules:
PieceInstances.allow({
	insert (userId: string, doc: PieceInstance): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
