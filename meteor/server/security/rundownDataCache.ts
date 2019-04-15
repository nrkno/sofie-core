import { RundownDataCache, RundownDataCacheObj } from '../../lib/collections/RundownDataCache'

// Setup rules:

RundownDataCache.allow({
	insert (userId: string, doc: RundownDataCacheObj): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
