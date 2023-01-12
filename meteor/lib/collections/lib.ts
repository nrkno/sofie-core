import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { MongoModifier, MongoQuery } from '../typings/meteor'
import {
	stringifyObjects,
	getHash,
	ProtectedString,
	makePromise,
	registerCollection,
	stringifyError,
	protectString,
	waitForPromise,
	waitForPromiseAll,
} from '../lib'
import * as _ from 'underscore'
import { logger } from '../logging'
import type { AnyBulkWriteOperation, Collection as RawCollection, Db as RawDb, CreateIndexesOptions } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MongoFieldSpecifier, MongoFieldSpecifierOnes, SortSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { CustomCollectionType } from '../api/pubsub'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const ObserveChangeBufferTimeout = 2000

type Timeout = number

export function ObserveChangesHelper<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncMongoCollection<DBInterface>,
	watchFields: (keyof DBInterface)[],
	doUpdate: (doc: DBInterface) => Promise<void>,
	changeDebounce: number,
	skipEnsureUpdatedOnStart?: boolean
): void {
	const observedChangesTimeouts = new Map<DBInterface['_id'], Timeout>()

	const projection: MongoFieldSpecifierOnes<DBInterface> = {}
	for (const field of watchFields) {
		projection[field] = 1
	}

	collection.find({}, { fields: projection }).observeChanges({
		changed: (id: DBInterface['_id'], changedFields) => {
			if (Object.keys(changedFields).length > 0) {
				const data: Timeout | undefined = observedChangesTimeouts.get(id)
				if (data !== undefined) {
					// Already queued, so do nothing
				} else {
					// Schedule update
					observedChangesTimeouts.set(
						id,
						Meteor.setTimeout(() => {
							// This looks like a race condition, but is safe as the data for the 'lost' change will still be loaded below
							observedChangesTimeouts.delete(id)

							// Perform hash update
							const obj = collection.findOne(id)
							if (obj) {
								waitForPromise(doUpdate(obj))
							}
						}, changeDebounce)
					)
				}
			}
		},
	})

	if (!skipEnsureUpdatedOnStart) {
		const existing = collection.find().fetch()
		waitForPromiseAll(existing.map(async (doc) => doUpdate(doc)))
	}
}

export function ObserveChangesForHash<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncMongoCollection<DBInterface>,
	hashName: keyof DBInterface,
	hashFields: (keyof DBInterface)[],
	skipEnsureUpdatedOnStart?: boolean
): void {
	const doUpdate = async (obj: DBInterface): Promise<void> => {
		const newHash = getHash(stringifyObjects(_.pick(obj, ...(hashFields as string[]))))

		if (newHash !== String(obj[hashName])) {
			logger.debug('Updating hash:', obj._id, `${String(hashName)}:${newHash}`)
			const update: Partial<DBInterface> = {}
			update[String(hashName)] = newHash
			await collection.updateAsync(obj._id, { $set: update })
		}
	}

	ObserveChangesHelper(collection, hashFields, doUpdate, ObserveChangeBufferTimeout, skipEnsureUpdatedOnStart)
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param options Open options
 */
export function createMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName,
	options?: {
		connection?: Object | null
		idGeneration?: string
	}
): AsyncMongoCollection<DBInterface> {
	const collection = new Mongo.Collection<DBInterface>(name, options)

	let collection2: AsyncMongoCollection<DBInterface>
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
 * Wrap an existing Mongo.Collection to have async methods. Primarily to convert the built-in Users collection
 * @param collection Collection to wrap
 * @param name Name of the collection
 */
export function wrapMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
): AsyncMongoCollection<DBInterface> {
	return new WrappedAsyncMongoCollection<DBInterface>(collection, name)
}

/**
 * Create a sync in-memory Mongo Collection (for ui temporary storage)
 * @param name Name of the collection (for logging)
 */
export function createInMemoryMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: string
): MongoCollection<DBInterface> {
	const collection = new Mongo.Collection<DBInterface>(null)
	return new WrappedMongoCollection<DBInterface>(collection, name)
}

/**
 * Create a Mongo Collection for a virtual collection populated by a custom-publication
 * @param name Name of the custom-collection
 */
export function createCustomPublicationMongoCollection<K extends keyof CustomCollectionType>(
	name: K
): MongoCollection<CustomCollectionType[K]> {
	const collection = new Mongo.Collection<CustomCollectionType[K]>(name)

	return new WrappedMongoCollection<CustomCollectionType[K]>(collection, name)
}

class WrappedMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	implements MongoCollection<DBInterface>
{
	readonly #collection: Mongo.Collection<DBInterface>

	public readonly name: string | null

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		this.#collection = collection
		this.name = name
	}

	protected get _isMock() {
		// @ts-expect-error re-export private property
		return this.#collection._isMock
	}

	public get mockCollection() {
		return this.#collection
	}

	private wrapMongoError(e: any): never {
		const str = (e && e.reason) || e.toString() || e || 'Unknown MongoDB Error'
		throw new Meteor.Error((e && e.error) || 500, `Collection "${this.name}": ${str}`)
	}

	allow(args: Parameters<MongoCollection<DBInterface>['allow']>[0]): boolean {
		const { insert: origInsert, update: origUpdate, remove: origRemove } = args
		const options: Parameters<Mongo.Collection<DBInterface>['allow']>[0] = {
			insert: origInsert ? (userId, doc) => waitForPromise(origInsert(protectString(userId), doc)) : undefined,
			update: origUpdate
				? (userId, doc, fieldNames, modifier) =>
						waitForPromise(origUpdate(protectString(userId), doc, fieldNames as any, modifier))
				: undefined,
			remove: origRemove ? (userId, doc) => waitForPromise(origRemove(protectString(userId), doc)) : undefined,
			fetch: args.fetch,
		}
		return this.#collection.allow(options)
	}
	deny(args: Parameters<MongoCollection<DBInterface>['deny']>[0]): boolean {
		const { insert: origInsert, update: origUpdate, remove: origRemove } = args
		const options: Parameters<Mongo.Collection<DBInterface>['deny']>[0] = {
			insert: origInsert ? (userId, doc) => waitForPromise(origInsert(protectString(userId), doc)) : undefined,
			update: origUpdate
				? (userId, doc, fieldNames, modifier) =>
						waitForPromise(origUpdate(protectString(userId), doc, fieldNames as any, modifier))
				: undefined,
			remove: origRemove ? (userId, doc) => waitForPromise(origRemove(protectString(userId), doc)) : undefined,
			fetch: args.fetch,
		}
		return this.#collection.deny(options)
	}
	find(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): MongoCursor<DBInterface> {
		try {
			return this.#collection.find((selector ?? {}) as any, options as any) as MongoCursor<DBInterface>
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): DBInterface | undefined {
		try {
			return this.#collection.findOne((selector ?? {}) as any, options as any)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	insert(doc: DBInterface): DBInterface['_id'] {
		try {
			const resultId = this.#collection.insert(doc as unknown as Mongo.OptionalId<DBInterface>)
			return protectString(resultId)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	rawCollection(): RawCollection<DBInterface> {
		return this.#collection.rawCollection() as any
	}
	rawDatabase(): RawDb {
		return this.#collection.rawDatabase() as any
	}
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id']): number {
		try {
			return this.#collection.remove(selector as any)
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
			return this.#collection.update(selector as any, modifier as any, options)
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
			const result = this.#collection.upsert(selector as any, modifier as any, options)
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
			return this.#collection.createIndex(index as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void {
		try {
			return this.#collection._ensureIndex(keys as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	_dropIndex(...args: Parameters<MongoCollection<DBInterface>['_dropIndex']>): void {
		try {
			return this.#collection._dropIndex(...args)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}

class WrappedAsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollection<DBInterface>
	implements AsyncMongoCollection<DBInterface>
{
	async findFetchAsync(
		selector: MongoQuery<DBInterface> | string,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		// Make the collection fethcing in another Fiber:
		return makePromise(() => {
			return this.find(selector as any, options).fetch()
		})
	}

	async findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		const arr = await this.findFetchAsync(selector, { ...options, limit: 1 })
		return arr[0]
	}

	async insertAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		return makePromise(() => {
			return this.insert(doc)
		})
	}

	async insertManyAsync(docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
		return Promise.all(docs.map((doc) => this.insert(doc)))
	}

	async insertIgnoreAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		return makePromise(() => {
			return this.insert(doc)
		}).catch((err) => {
			if (err.toString().match(/duplicate key/i)) {
				return doc._id
			} else {
				throw err
			}
		})
	}

	async updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number> {
		return makePromise(() => {
			return this.update(selector, modifier, options)
		})
	}

	async upsertAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }> {
		return makePromise(() => {
			return this.upsert(selector, modifier, options)
		})
	}

	async upsertManyAsync(docs: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }> {
		const result: {
			numberAffected: number
			insertedIds: DBInterface['_id'][]
		} = {
			numberAffected: 0,
			insertedIds: [],
		}
		await Promise.all(
			docs.map(async (doc) =>
				this.upsertAsync(doc._id, { $set: doc }).then((r) => {
					if (r.numberAffected) result.numberAffected += r.numberAffected
					if (r.insertedId) result.insertedIds.push(r.insertedId)
				})
			)
		)
		return result
	}

	async removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number> {
		return makePromise(() => {
			return this.remove(selector)
		})
	}

	async bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void> {
		if (ops.length > 0) {
			const rawCollection = this.rawCollection()
			const bulkWriteResult = await rawCollection.bulkWrite(ops, {
				ordered: false,
			})

			const writeErrors = bulkWriteResult?.getWriteErrors() ?? []
			if (writeErrors.length) {
				throw new Meteor.Error(500, `Errors in rawCollection.bulkWrite: ${writeErrors.join(',')}`)
			}
		}
	}
}

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollection<DBInterface>
	implements AsyncMongoCollection<DBInterface>
{
	private readonly realSleep: (time: number) => Promise<void>

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		super(collection, name)

		if (!this._isMock) throw new Meteor.Error(500, 'WrappedMockCollection is only valid for a mock collection')

		const realSleep = (Meteor as any).sleepNoFakeTimers
		if (!realSleep) throw new Error('Missing Meteor.sleepNoFakeTimers, looks like the mock is broken?')
		this.realSleep = realSleep
	}
	async findFetchAsync(
		selector: MongoQuery<DBInterface> | string,
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		await this.realSleep(0)
		return this.find(selector as any, options).fetch()
	}

	async findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		const arr = await this.findFetchAsync(selector, { ...options, limit: 1 })
		return arr[0]
	}

	async insertAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		await this.realSleep(0)
		return this.insert(doc)
	}

	async insertManyAsync(docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
		await this.realSleep(0)
		return Promise.all(docs.map((doc) => this.insert(doc)))
	}

	async insertIgnoreAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		await this.realSleep(0)
		try {
			return this.insert(doc)
		} catch (err) {
			if (stringifyError(err).match(/duplicate key/i)) {
				return doc._id
			} else {
				throw err
			}
		}
	}

	async updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number> {
		await this.realSleep(0)
		return this.update(selector, modifier, options)
	}

	async upsertAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }> {
		await this.realSleep(0)
		return this.upsert(selector, modifier, options)
	}

	async upsertManyAsync(docs: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }> {
		const result: {
			numberAffected: number
			insertedIds: DBInterface['_id'][]
		} = {
			numberAffected: 0,
			insertedIds: [],
		}
		await Promise.all(
			docs.map(async (doc) => {
				const r = this.upsert(doc._id, { $set: doc })
				if (r.numberAffected) result.numberAffected += r.numberAffected
				if (r.insertedId) result.insertedIds.push(r.insertedId)
			})
		)
		return result
	}

	async removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number> {
		await this.realSleep(0)
		return this.remove(selector)
	}

	async bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void> {
		if (ops.length > 0) {
			const rawCollection = this.rawCollection()
			const bulkWriteResult = await rawCollection.bulkWrite(ops, {
				ordered: false,
			})
			if (
				bulkWriteResult &&
				_.isArray(bulkWriteResult.result?.writeErrors) &&
				bulkWriteResult.result.writeErrors.length
			) {
				throw new Meteor.Error(
					500,
					`Errors in rawCollection.bulkWrite: ${bulkWriteResult.result.writeErrors.join(',')}`
				)
			}
		}
	}
}

/**
 * A minimal Async wrapping around the base Mongo.Collection type
 */
export interface AsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends MongoCollection<DBInterface> {
	name: string | null

	findFetchAsync(selector: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<Array<DBInterface>>
	findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<DBInterface | undefined>

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
}

/**
 * A minimal MongoCollection type based on the Meteor Mongo.Collection type, but with our improved _id type safety.
 * Note: when updating method signatures, make sure to update the implementions as new properties may not be fed through without additional work
 */
export interface MongoCollection<DBInterface extends { _id: ProtectedString<any> }> {
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
