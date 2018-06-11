import { RunningOrderBaselineAdLibItems, RunningOrderBaselineAdLibItem } from '../../lib/collections/RunningOrderBaselineAdLibItems'

// Setup rules:
RunningOrderBaselineAdLibItems.allow({
	insert (userId: string, doc: RunningOrderBaselineAdLibItem): boolean {
		return true // TODO: Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Not allowed client-side
	},
	remove (userId, doc) {
		return true // TODO: Not allowed client-side
	}
})
