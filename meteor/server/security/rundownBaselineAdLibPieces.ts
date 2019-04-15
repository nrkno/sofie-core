import { RunningOrderBaselineAdLibItems, RunningOrderBaselineAdLibItem } from '../../lib/collections/RunningOrderBaselineAdLibItems'

// Setup rules:
RunningOrderBaselineAdLibItems.allow({
	insert (userId: string, doc: RunningOrderBaselineAdLibItem): boolean {
		return true // TODO: Decide rules
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove (userId, doc) {
		return true // TODO: Decide rules
	}
})
