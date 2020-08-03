import { RundownBaselineAdLibPieces, RundownBaselineAdLibItem } from '../../lib/collections/RundownBaselineAdLibPieces'

// Setup rules:
RundownBaselineAdLibPieces.allow({
	insert(userId: string, doc: RundownBaselineAdLibItem): boolean {
		return true // TODO: Decide rules
	},
	update(userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove(userId, doc) {
		return true // TODO: Decide rules
	},
})
