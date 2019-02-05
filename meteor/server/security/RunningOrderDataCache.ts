import { RunningOrderDataCache, RunningOrderDataCacheObj } from '../../lib/collections/RunningOrderDataCache'

// Setup rules:

RunningOrderDataCache.allow({
	insert (userId: string, doc: RunningOrderDataCacheObj): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
