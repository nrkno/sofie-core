import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'

// Setup rules:
AdLibPieces.allow({
	insert (userId: string, doc: AdLibPiece): boolean {
		return true // TODO: Decide rules
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove (userId, doc) {
		return true // TODO: Decide rules
	}
})
