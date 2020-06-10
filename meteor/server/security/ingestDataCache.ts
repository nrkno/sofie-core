import { IngestDataCache, IngestDataCacheObj } from '../../lib/collections/IngestDataCache'

// Setup rules:

IngestDataCache.allow({
	insert(userId: string, doc: IngestDataCacheObj): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
