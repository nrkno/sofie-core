import { RunningOrderDataCache, RunningOrderDataCacheObj } from '../../lib/collections/RunningOrderDataCache'

// Setup rules:

RunningOrderDataCache.allow({
	insert (userId: string, doc: RunningOrderDataCacheObj): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
