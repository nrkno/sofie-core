import { DbCacheReadCollection, DbCacheWriteCollection, SelectorFunction } from './CacheCollection'
import { DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { ChangedIds, SaveIntoDbHooks, saveIntoBase } from '../db/changes'
import { JobContext } from '../jobs'

/**
 * Check if an object is a DbCacheReadCollection
 * @param o object to check
 */
export function isDbCacheReadCollection(o: unknown): o is DbCacheReadCollection<any> {
	return !!(o && typeof o === 'object' && 'fillWithDataFromDatabase' in o)
}
/**
 * Check if an object is a writable db object. (DbCacheWriteCollection, DbCacheWriteObject or DbCacheWriteOptionalObject)
 * @param o object to check
 */
export function isDbCacheWritable(
	o: unknown
): o is DbCacheWriteCollection<any> | DbCacheWriteObject<any> | DbCacheWriteOptionalObject<any> {
	return !!(o && typeof o === 'object' && 'updateDatabaseWithData' in o)
}

/**
 * Save a new array of data into the cache, replacing all existing data that matches the filter
 * @param context Context for the job
 * @param collection Cache Collection to write changes into
 * @param filter Filter to match the documents that will be removed if not replaced by a new document
 * @param newData New documents to push to the collection
 * @param optionsOrg Hooks called during the collection modification
 * @returns Object describing the changes which were made to the collection
 */
export function saveIntoCache<TDoc extends { _id: ProtectedString<any> }>(
	context: JobContext,
	collection: DbCacheWriteCollection<TDoc>,
	filter: SelectorFunction<TDoc> | null,
	newData: Array<TDoc>,
	optionsOrg?: SaveIntoDbHooks<TDoc>
): ChangedIds<TDoc['_id']> {
	return saveIntoBase(context, collection.name ?? '', collection.findAll(filter), newData, {
		...optionsOrg,
		insert: (doc) => collection.insert(doc),
		update: (doc) => collection.replace(doc),
		remove: (doc) => collection.remove(doc._id),
	})
}

/**
 * Log the changes made for a collection
 * @param collection Name of the collection to log
 * @param changes ChangeIds object returned from saveIntoCache
 */
export function logChanges(collection: string, changes: ChangedIds<ProtectedString<any>>): void {
	logger.debug(
		`Update collection of "${collection}". Inserted: [${changes.added}] Updated: [${changes.updated}] Removed: [${changes.removed}] Unchanged: ${changes.unchanged.length}`
	)
}
