import { AdLibActions, AdLibAction } from '../../lib/collections/AdLibActions'

// Setup rules:
AdLibActions.allow({
	insert (userId: string, doc: AdLibAction): boolean {
		return true // TODO: Decide rules
	},
	update (userId, doc, fields, modifier) {
		return true // TODO: Decide rules
	},
	remove (userId, doc) {
		return true // TODO: Decide rules
	}
})
