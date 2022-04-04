import { ProtectedString } from './lib'
import { Meteor } from 'meteor/meteor'
import { AsyncMongoCollection, IndexSpecifier } from './collections/lib'

interface CollectionsIndexes {
	[collectionName: string]: CollectionIndexes<any>
}
interface CollectionIndexes<DBInterface extends { _id: ProtectedString<any> }> {
	collection: AsyncMongoCollection<DBInterface>
	indexes: IndexSpecifier<DBInterface>[]
}

const registeredIndexes: CollectionsIndexes = {}
/**
 * Register an index for a collection. This function should be called right after a collection has been created.
 * @param collection
 * @param index
 */
export function registerIndex<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncMongoCollection<DBInterface>,
	index: IndexSpecifier<DBInterface>
) {
	if (!Meteor.isServer) return // only used server-side

	const collectionName = collection.rawCollection().collectionName
	// const collectionName = collection['name']
	if (!collectionName) throw new Meteor.Error(500, `Error: collection.rawCollection.collectionName not set`)
	if (!registeredIndexes[collectionName]) registeredIndexes[collectionName] = { collection: collection, indexes: [] }

	registeredIndexes[collectionName].indexes.push(index)
}
export function getTargetRegisteredIndexes() {
	return registeredIndexes
}
