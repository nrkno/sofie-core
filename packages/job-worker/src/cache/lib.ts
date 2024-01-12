import { DbCacheWriteCollection, SelectorFunction } from './CacheCollection'
import { DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { logger } from '../logging'
import { ChangedIds, SaveIntoDbHooks, saveIntoBase } from '../db/changes'
import { JobContext } from '../jobs'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')

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

/**
 * Perform a diff of a pair of arrays of documents
 * @param changedIds Set of changed document ids to update in place
 * @param oldObjects Old documents to compare
 * @param newObjects New documents to compare
 * @param mergeFn Optional merge to perform before diffing, this change will be present in the returned values
 * @returns Array of the documents. Contains unchanged items from oldObjects, and changed items from newObjects
 */
export function diffAndReturnLatestObjects<T extends { _id: ProtectedString<any> }>(
	changedIds: Set<T['_id']>,
	oldObjects: T[],
	newObjects: T[],
	mergeFn?: (oldValue: T, newValue: T) => T
): T[] {
	const oldObjectMap = normalizeArrayToMap(oldObjects, '_id')

	const result: T[] = []

	// Compare each newObject
	for (const newObject of newObjects) {
		const oldObject = oldObjectMap.get(newObject._id)
		oldObjectMap.delete(newObject._id)

		const mergedObject = mergeFn && oldObject ? mergeFn(oldObject, newObject) : newObject

		if (!oldObject || changedIds.has(mergedObject._id) || !_.isEqual(oldObject, mergedObject)) {
			result.push(mergedObject)
			changedIds.add(mergedObject._id)
		} else {
			result.push(oldObject)
		}
	}

	// Anything left in the map is missing in the newObjects array
	for (const oldObjectId of oldObjectMap.keys()) {
		changedIds.add(oldObjectId)
	}

	return result
}
