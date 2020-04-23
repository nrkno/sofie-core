import { RundownBaselineAdLibActions, RundownBaselineAdLibAction } from '../../lib/collections/RundownBaselineAdLibActions'

// Setup rules:
RundownBaselineAdLibActions.allow({
	insert (userId: string, doc: RundownBaselineAdLibAction): boolean {
		return true // TODO: Decide rules
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove (userId, doc) {
		return true // TODO: Decide rules
	}
})
