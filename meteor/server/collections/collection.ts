import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoModifier, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { NpmModuleMongodb } from 'meteor/npm-mongo'
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
import { PromisifyCallbacks, waitForPromise } from '../../lib/lib'
import type { AnyBulkWriteOperation, Collection as RawCollection } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { registerCollection } from './lib'
import { WrappedMockCollection } from './implementations/mock'
import { WrappedAsyncMongoCollection } from './implementations/asyncCollection'
import { WrappedReadOnlyMongoCollection } from './implementations/readonlyWrapper'

export interface MongoAllowRules<DBInterface> {
	insert?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
	update?: (
		userId: UserId,
		doc: DBInterface,
		fieldNames: FieldNames<DBInterface>,
		modifier: MongoModifier<DBInterface>
	) => Promise<boolean> | boolean
	remove?: (userId: UserId, doc: DBInterface) => Promise<boolean> | boolean
}

/**
 * Wrap an existing Mongo.Collection to have async methods. Primarily to convert the built-in Users collection
 * @param collection Collection to wrap
 * @param name Name of the collection
 * @param allowRules The 'allow' rules for publications. Set to `false` to make readonly
 */
export function wrapMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName,
	allowRules: MongoAllowRules<DBInterface> | false
): AsyncOnlyMongoCollection<DBInterface> {
	if (collectionsCache.has(name)) throw new Meteor.Error(500, `Collection "${name}" has already been created`)
	collectionsCache.set(name, collection)

	setupCollectionAllowRules(collection, allowRules)

	const wrapped = new WrappedAsyncMongoCollection<DBInterface>(collection, name)

	registerCollection(name, wrapped as WrappedAsyncMongoCollection<any>)

	return wrapped
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param allowRules The 'allow' rules for publications. Set to `false` to make readonly
 */
export function createAsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName,
	allowRules: MongoAllowRules<DBInterface> | false
): AsyncOnlyMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	setupCollectionAllowRules(collection, allowRules)

	const wrappedCollection = wrapMeteorCollectionIntoAsyncCollection<DBInterface>(collection, name)

	registerCollection(name, wrappedCollection)

	return wrappedCollection
}

/**
 * Create a fully featured MongoCollection
 * Note: this will automatically make this collection readonly to any publications
 * @param name Name of the collection in mongodb
 */
export function createAsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	const mutableCollection = wrapMeteorCollectionIntoAsyncCollection<DBInterface>(collection, name)
	const readonlyCollection = new WrappedReadOnlyMongoCollection<DBInterface>(mutableCollection)

	registerCollection(name, readonlyCollection)

	setupCollectionAllowRules(collection, false)

	return readonlyCollection
}

function wrapMeteorCollectionIntoAsyncCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
) {
	if ((collection as any)._isMock) {
		// We use a special one in tests, to reduce the amount of hops between fibers and promises
		return new WrappedMockCollection<DBInterface>(collection, name)
	} else {
		// Override the default mongodb methods, because the errors thrown by them doesn't contain the proper call stack
		return new WrappedAsyncMongoCollection<DBInterface>(collection, name)
	}
}

function setupCollectionAllowRules<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	args: MongoAllowRules<DBInterface> | false
) {
	if (args) {
		const { insert: origInsert, update: origUpdate, remove: origRemove } = args

		const options: Parameters<Mongo.Collection<DBInterface>['allow']>[0] = {
			insert: origInsert ? (userId, doc) => waitForPromise(origInsert(protectString(userId), doc)) : () => false,
			update: origUpdate
				? (userId, doc, fieldNames, modifier) =>
						waitForPromise(origUpdate(protectString(userId), doc, fieldNames as any, modifier))
				: () => false,
			remove: origRemove ? (userId, doc) => waitForPromise(origRemove(protectString(userId), doc)) : () => false,
		}

		collection.allow(options)
	} else {
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
	}
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

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: NpmModuleMongodb.CreateIndexesOptions): void
}
