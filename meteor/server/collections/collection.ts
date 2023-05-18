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
import { WrappedReadOnlyMongoCollection } from './implementations/readonlyWrapper'
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

	const wrappedCollection = createAsyncCollectionInner(collection, name)

	registerCollection(name, wrappedCollection)

	return wrappedCollection
}

function createAsyncCollectionInner<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
) {
	if ((collection as any)._isMock) {
		return new WrappedMockCollection(collection, name)
	} else {
		// Override the default mongodb methods, because the errors thrown by them doesn't contain the proper call stack
		return new WrappedAsyncMongoCollection(collection, name)
	}
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param options Open options
 */
export function createAsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	const mutableCollection = createAsyncCollectionInner(collection, name)
	const readonlyCollection = new WrappedReadOnlyMongoCollection(mutableCollection)

	registerCollection(name, readonlyCollection)

	// Block all client mutations
	collection.allow({
		insert(): boolean {
			return false
		},
		update() {
			return false
		},
		remove() {
			return false
		},
	})

	return readonlyCollection
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	/**
	 * Insert a document
	 * @param document The document to insert
	 */
	insertAsync(doc: DBInterface): Promise<DBInterface['_id']>

	/**
	 * Insert multiple documents
	 * @param documents The documents to insert
	 */
	insertManyAsync(doc: DBInterface[]): Promise<Array<DBInterface['_id']>>

	/**
	 * Perform an update of a document
	 * @param selector A query describing the documents to update
	 * @param modifier The operation to apply to each matching document
	 * @param options Options for the operation
	 */
	updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number>

	/**
	 * Perform an update/insert of a document
	 * @param selector A query describing the documents to update. Typically this will be an id
	 * @param modifier The operation to apply to each matching document
	 * @param options Options for the operation
	 */
	upsertAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }>

	/**
	 * Perform an upsert for multiple documents, based on the `_id` of each document
	 * @param documents Documents to upsert
	 */
	upsertManyAsync(doc: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }>

	/**
	 * Remove one or more documents
	 * @param selector A query describing the documents to be deleted
	 */
	removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number>

	/**
	 * Perform multiple operations on the collection in one operation
	 * This should be used instead of Promise.all(...) when doing multiple updates, as it is more performant
	 * @param ops Operations to perform
	 */
	bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void>

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
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }> {
	name: string | null

	/**
	 * Get a mutable handle to the collection
	 * Warning: This can be unsafe to use if the job-worker is processing a job
	 */
	mutableCollection: AsyncOnlyMongoCollection<DBInterface>

	/**
	 * Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawCollection(): RawCollection<DBInterface>

	/**
	 * Find and return multiple documents
	 * @param selector A query describing the documents to find
	 * @param options Options for the operation
	 */
	findFetchAsync(selector: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<Array<DBInterface>>

	/**
	 * Find and return a document
	 * @param selector A query describing the document to find
	 * @param options Options for the operation
	 */
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

	/**
	 * Count the number of docuyments in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number>

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void
}
