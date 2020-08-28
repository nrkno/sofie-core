import * as _ from 'underscore'
import { makePromise } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewSystemAPI, SystemAPIMethods } from '../../lib/api/system'
import { getAllIndexes } from '../../lib/database'
import { Meteor } from 'meteor/meteor'
import { IndexSpecification } from 'mongodb'
import { TransformedCollection } from '../../lib/typings/meteor'
import { logger } from '../logging'
import { MeteorWrapAsync } from '../codeControl'
import { SystemWriteAccess } from '../security/system'
import { check } from '../../lib/check'

function setupIndexes(removeOldIndexes: boolean = false): IndexSpecification[] {
	const indexes = getAllIndexes()
	if (!Meteor.isServer) throw new Meteor.Error(500, `setupIndexes() can only be run server-side`)

	const removeIndexes: IndexSpecification[] = []
	_.each(indexes, (i, collectionName) => {
		const existingIndexes = getCollectionIndexes(i.collection)

		// Check if there are old indexes in the database that should be removed:
		_.each(existingIndexes, (existingIndex) => {
			// don't touch the users collection, as Metoer adds a few indexes of it's own
			if (collectionName === 'users') return
			if (!existingIndex.name) return // ?

			// Check if the existing index should be kept:
			let found = _.find([...i.indexes, { _id: 1 }], (newIndex) => {
				return _.isEqual(newIndex, existingIndex.key)
			})

			if (!found) {
				removeIndexes.push(existingIndex)
				// The existing index does not exist in our specified list of indexes, and should be removed.
				if (removeOldIndexes) {
					logger.info(`Removing index: ${JSON.stringify(existingIndex.key)}`)
					i.collection.rawCollection().dropIndex(existingIndex.name)
				}
			}
		})

		// Ensure new indexes (add if not existing):
		_.each(i.indexes, (index) => {
			i.collection._ensureIndex(index)
		})
	})
	return removeIndexes
}

const getCollectionIndexes: (collection: TransformedCollection<any, any>) => IndexSpecification[] = MeteorWrapAsync(
	function getCollectionIndexes(collection: TransformedCollection<any, any>, callback: (err, result) => void) {
		collection.rawCollection().indexes(callback)
	}
)

Meteor.startup(() => {
	// Ensure indexes are created on startup:
	setupIndexes(false)
})

export function cleanupIndexes(context: MethodContext, actuallyRemoveOldIndexes: boolean): IndexSpecification[] {
	check(actuallyRemoveOldIndexes, Boolean)
	SystemWriteAccess.coreSystem(context)

	return setupIndexes(actuallyRemoveOldIndexes)
}
class SystemAPIClass extends MethodContextAPI implements NewSystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean) {
		return makePromise(() => cleanupIndexes(this, actuallyRemoveOldIndexes))
	}
}
registerClassToMeteorMethods(SystemAPIMethods, SystemAPIClass, false)
