import { ProtectedString } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { IndexSpecifier } from '../../lib/collections/lib'
import { ServerAsyncOnlyMongoCollection } from './collection'

interface CollectionsIndexes {
	[collectionName: string]: CollectionIndexes<any>
}
interface CollectionIndexes<DBInterface extends { _id: ProtectedString<any> }> {
	collection: ServerAsyncOnlyMongoCollection<DBInterface>
	indexes: IndexSpecifier<DBInterface>[]
}

const registeredIndexes: CollectionsIndexes = {}
/**
 * Register an index for a collection. This function should be called right after a collection has been created.
 * @param collection
 * @param index
 */
export function registerIndex<DBInterface extends { _id: ProtectedString<any> }>(
	collection: ServerAsyncOnlyMongoCollection<DBInterface>,
	index: IndexSpecifier<DBInterface>
): void {
	if (!Meteor.isServer) return // only used server-side

	const collectionName = collection.rawCollection().collectionName
	// const collectionName = collection['name']
	if (!collectionName) throw new Meteor.Error(500, `Error: collection.rawCollection.collectionName not set`)
	if (!registeredIndexes[collectionName]) registeredIndexes[collectionName] = { collection: collection, indexes: [] }

	registeredIndexes[collectionName].indexes.push(index)
}
export function getTargetRegisteredIndexes(): CollectionsIndexes {
	return registeredIndexes
}
