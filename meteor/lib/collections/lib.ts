import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { MongoModifier, MongoQuery } from '../typings/meteor'
import { ProtectedString, protectString } from '../lib'
import type { Collection as RawCollection, Db as RawDb, CreateIndexesOptions } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MongoFieldSpecifier, SortSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { CustomCollectionType } from '../api/pubsub'

export const ClientCollections = new Map<CollectionName, MongoCollection<any> | WrappedMongoReadOnlyCollection<any>>()
function registerClientCollection(
	name: CollectionName,
	collection: MongoCollection<any> | WrappedMongoReadOnlyCollection<any>
): void {
	if (ClientCollections.has(name)) throw new Meteor.Error(`Cannot re-register collection "${name}"`)
	ClientCollections.set(name, collection)
}

/**
 * Map of current collection objects.
 * Future: Could this weakly hold the collections?
 */
export const collectionsCache = new Map<string, Mongo.Collection<any>>()
export function getOrCreateMongoCollection(name: string): Mongo.Collection<any> {
	const collection = collectionsCache.get(name)
	if (collection) {
		return collection
	}

	const newCollection = new Mongo.Collection(name)
	collectionsCache.set(name, newCollection)
	return newCollection
}

/**
 * Wrap an existing Mongo.Collection to have async methods. Primarily to convert the built-in Users collection
 * @param collection Collection to wrap
 * @param name Name of the collection
 */
export function wrapMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
): MongoCollection<DBInterface> {
	const wrapped = new WrappedMongoCollection<DBInterface>(collection, name)

	registerClientCollection(name, wrapped)

	return wrapped
}

/**
 * Create a sync in-memory Mongo Collection (for ui temporary storage)
 * @param name Name of the collection (for logging)
 */
export function createInMemorySyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: string
): MongoCollection<DBInterface> {
	const collection = new Mongo.Collection<DBInterface>(null)
	return new WrappedMongoCollection<DBInterface>(collection, name)
}

/**
 * Create a Mongo Collection for use in the client (has sync apis)
 * @param name Name of the collection
 */
export function createSyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): MongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)
	const wrapped = new WrappedMongoCollection<DBInterface>(collection, name)

	registerClientCollection(name, wrapped)

	return wrapped
}

/**
 * Create a Mongo Collection for use in the client (has sync apis)
 * @param name Name of the collection
 */
export function createSyncReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): MongoReadOnlyCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)
	const wrapped = new WrappedMongoReadOnlyCollection<DBInterface>(collection, name)

	registerClientCollection(name, wrapped)

	return wrapped
}

/**
 * Create a Mongo Collection for a virtual collection populated by a custom-publication
 * @param name Name of the custom-collection
 */
export function createSyncCustomPublicationMongoCollection<K extends keyof CustomCollectionType>(
	name: K
): MongoReadOnlyCollection<CustomCollectionType[K]> {
	const collection = new Mongo.Collection<CustomCollectionType[K]>(name)

	return new WrappedMongoReadOnlyCollection<CustomCollectionType[K]>(collection, name)
}

class WrappedMongoReadOnlyCollection<DBInterface extends { _id: ProtectedString<any> }>
	implements MongoReadOnlyCollection<DBInterface>
{
	protected readonly _collection: Mongo.Collection<DBInterface>

	public readonly name: string | null

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		this._collection = collection
		this.name = name
	}

	protected get _isMock() {
		// @ts-expect-error re-export private property
		return this._collection._isMock
	}

	public get mockCollection() {
		return this._collection
	}

	protected wrapMongoError(e: any): never {
		const str = (e && e.reason) || e.toString() || e || 'Unknown MongoDB Error'
		throw new Meteor.Error((e && e.error) || 500, `Collection "${this.name}": ${str}`)
	}

	find(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): MongoCursor<DBInterface> {
		try {
			return this._collection.find((selector ?? {}) as any, options as any) as MongoCursor<DBInterface>
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): DBInterface | undefined {
		try {
			return this._collection.findOne((selector ?? {}) as any, options as any)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}
export class WrappedMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoReadOnlyCollection<DBInterface>
	implements MongoCollection<DBInterface>
{
	insert(doc: DBInterface): DBInterface['_id'] {
		try {
			const resultId = this._collection.insert(doc as unknown as Mongo.OptionalId<DBInterface>)
			return protectString(resultId)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	rawCollection(): RawCollection<DBInterface> {
		return this._collection.rawCollection() as any
	}
	rawDatabase(): RawDb {
		return this._collection.rawDatabase() as any
	}
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id']): number {
		try {
			return this._collection.remove(selector as any)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	update(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): number {
		try {
			return this._collection.update(selector as any, modifier as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	upsert(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	} {
		try {
			const result = this._collection.upsert(selector as any, modifier as any, options)
			return {
				numberAffected: result.numberAffected,
				insertedId: protectString(result.insertedId),
			}
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	createIndex(index: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void {
		try {
			return this._collection.createIndex(index as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void {
		try {
			return this._collection._ensureIndex(keys as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	_dropIndex(...args: Parameters<MongoCollection<DBInterface>['_dropIndex']>): void {
		try {
			return this._collection._dropIndex(...args)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}

export interface MongoReadOnlyCollection<DBInterface extends { _id: ProtectedString<any> }> {
	/**
	 * Find the documents in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	find(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): MongoCursor<DBInterface>

	/**
	 * Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
	 * @param selector A query describing the documents to find
	 */
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): DBInterface | undefined
}
/**
 * A minimal MongoCollection type based on the Meteor Mongo.Collection type, but with our improved _id type safety.
 * Note: when updating method signatures, make sure to update the implementions as new properties may not be fed through without additional work
 */
export interface MongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends MongoReadOnlyCollection<DBInterface> {
	/**
	 * Insert a document in the collection.  Returns its unique _id.
	 * @param doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
	 */
	insert(doc: DBInterface): DBInterface['_id']

	/**
	 * Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawCollection(): RawCollection<DBInterface>

	/**
	 * Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawDatabase(): RawDb

	/**
	 * Remove documents from the collection
	 * @param selector Specifies which documents to remove
	 */
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id']): number

	/**
	 * Modify one or more documents in the collection. Returns the number of matched documents.
	 * @param selector Specifies which documents to modify
	 * @param modifier Specifies how to modify the documents
	 */
	update(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): number

	/**
	 * Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified) and
	 * `insertedId` (the unique _id of the document that was inserted, if any).
	 * @param selector Specifies which documents to modify
	 * @param modifier Specifies how to modify the documents
	 */
	upsert(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	}

	/**
	 * Creates the specified index on the collection.
	 * @param index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field.
	 * For an ascending index on a field, specify a value of 1; for descending index, specify a value of -1. Use text for text indexes.
	 * @param options
	 */
	createIndex(index: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void

	/** @deprecated - use createIndex */
	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void

	_dropIndex(indexName: string): void
}

export interface UpdateOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
	/** True to insert a document if no matching documents are found. */
	upsert?: boolean
	/**
	 * Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to
	 * modify in an array field.
	 */
	arrayFilters?: { [identifier: string]: any }[]
}
export interface UpsertOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
}

export type IndexSpecifier<T> = {
	[P in keyof T]?: -1 | 1 | string
}

export interface MongoCursor<DBInterface extends { _id: ProtectedString<any> }>
	extends Omit<Mongo.Cursor<DBInterface>, 'observe' | 'observeChanges'> {
	observe(callbacks: ObserveCallbacks<DBInterface>): Meteor.LiveQueryHandle
	observeChanges(callbacks: ObserveChangesCallbacks<DBInterface>): Meteor.LiveQueryHandle
}
export interface ObserveCallbacks<DBInterface> {
	added?(document: DBInterface): void
	addedAt?(document: DBInterface, atIndex: number, before: DBInterface): void
	changed?(newDocument: DBInterface, oldDocument: DBInterface): void
	changedAt?(newDocument: DBInterface, oldDocument: DBInterface, indexAt: number): void
	removed?(oldDocument: DBInterface): void
	removedAt?(oldDocument: DBInterface, atIndex: number): void
	movedTo?(document: DBInterface, fromIndex: number, toIndex: number, before: Object): void
}
export interface ObserveChangesCallbacks<DBInterface extends { _id: ProtectedString<any> }> {
	added?(id: DBInterface['_id'], fields: Object): void
	addedBefore?(id: DBInterface['_id'], fields: Object, before: Object): void
	changed?(id: DBInterface['_id'], fields: Object): void
	movedBefore?(id: DBInterface['_id'], before: Object): void
	removed?(id: DBInterface['_id']): void
}

export interface FindOneOptions<TRawDoc> {
	/** Sort order (default: natural order) */
	sort?: SortSpecifier<TRawDoc>
	/** Number of results to skip at the beginning */
	skip?: number
	/** @deprecated Dictionary of fields to return or exclude. */
	fields?: MongoFieldSpecifier<TRawDoc>
	/** Dictionary of fields to return or exclude. */
	projection?: MongoFieldSpecifier<TRawDoc>
	/** (Client only) Default `true`; pass `false` to disable reactivity */
	reactive?: boolean
	/** Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation. */
	//  transform?: Transform<TRawDoc, TDoc>;
	/** (Server only) Specifies a custom MongoDB readPreference for this particular cursor. Possible values are primary, primaryPreferred, secondary, secondaryPreferred and nearest. */
	readPreference?: string
}
export interface FindOptions<DBInterface> extends FindOneOptions<DBInterface> {
	/** Maximum number of results to return */
	limit?: number
	/** (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to observe on this query. Disabling the oplog can be useful when working with data that updates in large batches. */
	disableOplog?: boolean
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds). */
	pollingIntervalMs?: number
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms. */
	pollingThrottleMs?: number
	/** (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error. */
	maxTimeMs?: number
	/** (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify { $natural : 1 } to force a forwards collection scan, or { $natural : -1 } for a reverse collection scan. Setting this is only recommended for advanced users. */
	hint?: string | object
}

export type FieldNames<DBInterface> = (keyof DBInterface)[]
