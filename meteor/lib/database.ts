import { IndexSpecifier } from './typings/meteor'
import { ProtectedString } from './lib'
import { Meteor } from 'meteor/meteor'
import { AsyncMongoCollection } from './collections/lib'

interface CollectionsIndexes {
	[collectionName: string]: CollectionIndexes<any>
}
interface CollectionIndexes<DBInterface extends { _id: ProtectedString<any> }> {
	collection: AsyncMongoCollection<DBInterface>
	indexes: IndexSpecifier<DBInterface>[]
}

const indexes: CollectionsIndexes = {}
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
	if (!indexes[collectionName]) indexes[collectionName] = { collection: collection, indexes: [] }

	indexes[collectionName].indexes.push(index)
}
export function getAllIndexes() {
	return indexes
}
