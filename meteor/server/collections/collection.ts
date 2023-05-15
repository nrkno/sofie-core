import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoModifier, MongoQuery } from '../../lib/typings/meteor'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import {
	UpdateOptions,
	UpsertOptions,
	FieldNames,
	getOrCreateMongoCollection,
	FindOptions,
	collectionsCache,
	IndexSpecifier,
	MongoCursor,
	ObserveChangesCallbacks,
	ObserveCallbacks,
} from '../../lib/collections/lib'
import type { AnyBulkWriteOperation, Collection as RawCollection, CreateIndexesOptions } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { registerCollection } from './lib'
import { WrappedMockCollection } from './implementations/mock'
import { WrappedAsyncMongoCollection } from './implementations/asyncCollection'
import { PromisifyCallbacks } from '../../lib/lib'

/**
 * Wrap an existing Mongo.Collection to have async methods. Primarily to convert the built-in Users collection
 * @param collection Collection to wrap
 * @param name Name of the collection
 */
export function wrapMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
): AsyncOnlyMongoCollection<DBInterface> {
	if (collectionsCache.has(name)) throw new Meteor.Error(500, `Collection "${name}" has already been created`)
	collectionsCache.set(name, collection)

	const wrapped = new WrappedAsyncMongoCollection<DBInterface>(collection, name)

	registerCollection(name, wrapped)

	return wrapped
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param options Open options
 */
export function createAsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
	// options?: {
	// 	connection?: Object | null
	// 	idGeneration?: string
	// }
): AsyncOnlyMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	let collection2: AsyncOnlyMongoCollection<DBInterface>
	if ((collection as any)._isMock) {
		collection2 = new WrappedMockCollection(collection, name)
	} else {
		// Override the default mongodb methods, because the errors thrown by them doesn't contain the proper call stack
		collection2 = new WrappedAsyncMongoCollection(collection, name)
	}

	registerCollection(name, collection2)

	return collection2
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }> {
	name: string | null

	/**
	 * Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawCollection(): RawCollection<DBInterface>

	findFetchAsync(selector: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<Array<DBInterface>>
	findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<DBInterface | undefined>

	/**
	 * Retrieve a cursor for use in a publication
	 * @param selector A query describing the documents to find
	 */
	findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<MongoCursor<DBInterface>>

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle

	insertAsync(doc: DBInterface): Promise<DBInterface['_id']>

	insertManyAsync(doc: DBInterface[]): Promise<Array<DBInterface['_id']>>

	insertIgnoreAsync(doc: DBInterface): Promise<DBInterface['_id']>

	updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number>

	upsertAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }>

	upsertManyAsync(doc: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }>

	removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number>

	bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void>

	/**
	 * Count the number of docuyments in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number>

	/**
	 * Allow users to write directly to this collection from client code, subject to limitations you define.
	 */
	allow(options: {
		insert?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
		update?: (
			userId: UserId,
			doc: DBInterface,
			fieldNames: FieldNames<DBInterface>,
			modifier: MongoModifier<DBInterface>
		) => Promise<boolean> | boolean
		remove?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
		fetch?: string[]
		// transform?: Function
	}): boolean

	/**
	 * Override allow rules.
	 */
	deny(options: {
		insert?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
		update?: (
			userId: UserId,
			doc: DBInterface,
			fieldNames: FieldNames<DBInterface>,
			modifier: MongoModifier<DBInterface>
		) => Promise<boolean> | boolean
		remove?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
		fetch?: string[]
		// transform?: Function
	}): boolean

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void
}
