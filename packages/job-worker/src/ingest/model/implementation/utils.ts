import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')

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
