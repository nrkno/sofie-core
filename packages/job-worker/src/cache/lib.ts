import { DbCacheWriteCollection, SelectorFunction } from './CacheCollection'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { ChangedIds, SaveIntoDbHooks, saveIntoBase } from '../db/changes'
import { JobContext } from '../jobs'

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
