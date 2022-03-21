import { DbCacheReadCollection, DbCacheWriteCollection } from './CacheCollection'
import { DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'
import { MongoQuery } from '../db'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { ChangedIds, SaveIntoDbHooks, saveIntoBase } from '../db/changes'
import { JobContext } from '../jobs'

export function isDbCacheReadCollection(o: unknown): o is DbCacheReadCollection<any> {
	return !!(o && typeof o === 'object' && 'fillWithDataFromDatabase' in o)
}
export function isDbCacheWritable(
	o: unknown
): o is DbCacheWriteCollection<any> | DbCacheWriteObject<any> | DbCacheWriteOptionalObject<any> {
	return !!(o && typeof o === 'object' && 'updateDatabaseWithData' in o)
}
/** Caches data, allowing reads from cache, but not writes */
export function saveIntoCache<TDoc extends { _id: ProtectedString<any> }>(
	context: JobContext,
	collection: DbCacheWriteCollection<TDoc>,
	filter: MongoQuery<TDoc>,
	newData: Array<TDoc>,
	optionsOrg?: SaveIntoDbHooks<TDoc>
): ChangedIds<TDoc['_id']> {
	return saveIntoBase(context, collection.name ?? '', collection.findFetch(filter), newData, {
		...optionsOrg,
		insert: (doc) => collection.insert(doc),
		update: (doc) => collection.replace(doc),
		remove: (doc) => collection.remove(doc._id),
	})
}

export function logChanges(collection: string, changes: ChangedIds<ProtectedString<any>>): void {
	logger.debug(
		`Update collection of "${collection}". Inserted: [${changes.added}] Updated: [${changes.updated}] Removed: [${changes.removed}] Unchanged: ${changes.unchanged.length}`
	)
}
