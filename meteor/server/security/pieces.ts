import { Pieces, Piece } from '../../lib/collections/Pieces'

// Setup rules:
Pieces.allow({
	insert(userId: string, doc: Piece): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
