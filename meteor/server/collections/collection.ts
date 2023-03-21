import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoModifier, MongoQuery } from '../../lib/typings/meteor'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
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
import { makePromise, stringifyError, waitForPromise } from '../../lib/lib'
import type { AnyBulkWriteOperation, Collection as RawCollection, Db as RawDb, CreateIndexesOptions } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import _ from 'underscore'
import { registerCollection } from './lib'

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

class WrappedMongoCollectionBase<DBInterface extends { _id: ProtectedString<any> }> {
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

	rawCollection(): RawCollection<DBInterface> {
		return this._collection.rawCollection() as any
	}
	rawDatabase(): RawDb {
		return this._collection.rawDatabase() as any
	}

	protected find(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): MongoCursor<DBInterface> {
		try {
			return this._collection.find((selector ?? {}) as any, options as any) as MongoCursor<DBInterface>
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	protected insert(doc: DBInterface): DBInterface['_id'] {
		try {
			const resultId = this._collection.insert(doc as unknown as Mongo.OptionalId<DBInterface>)
			return protectString(resultId)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	protected remove(selector: MongoQuery<DBInterface> | DBInterface['_id']): number {
		try {
			return this._collection.remove(selector as any)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
	protected update(
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
	protected upsert(
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

	_ensureIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void {
		try {
			return this._collection._ensureIndex(keys as any, options)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}

class WrappedAsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollectionBase<DBInterface>
	implements AsyncOnlyMongoCollection<DBInterface>
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

	async findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<MongoCursor<DBInterface>> {
		return this.find(selector as any, options)
	}

	observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: ObserveChangesCallbacks<DBInterface>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector as any, options).observeChanges(callbacks)
	}

	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: ObserveCallbacks<DBInterface>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector as any, options).observe(callbacks)
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

	async countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number> {
		return makePromise(() => {
			try {
				return this._collection.find((selector ?? {}) as any, options as any).count()
			} catch (e) {
				this.wrapMongoError(e)
			}
		})
	}

	allow(args: Parameters<AsyncOnlyMongoCollection<DBInterface>['allow']>[0]): boolean {
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
		return this._collection.allow(options)
	}
	deny(args: Parameters<AsyncOnlyMongoCollection<DBInterface>['deny']>[0]): boolean {
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
		return this._collection.deny(options)
	}
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
		callbacks: ObserveChangesCallbacks<DBInterface>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: ObserveCallbacks<DBInterface>,
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

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollectionBase<DBInterface>
	implements AsyncOnlyMongoCollection<DBInterface>
{
	private readonly realSleep: (time: number) => Promise<void>

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		super(collection, name)

		if (!this._isMock) throw new Meteor.Error(500, 'WrappedMockCollection is only valid for a mock collection')

		const realSleep = (Meteor as any).sleepNoFakeTimers
		if (!realSleep) throw new Error('Missing Meteor.sleepNoFakeTimers, looks like the mock is broken?')
		this.realSleep = realSleep
	}

	allow(args: Parameters<AsyncOnlyMongoCollection<DBInterface>['allow']>[0]): boolean {
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
		return this._collection.allow(options)
	}
	deny(args: Parameters<AsyncOnlyMongoCollection<DBInterface>['deny']>[0]): boolean {
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
		return this._collection.deny(options)
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

	/**
	 * Retrieve a cursor for use in a publication
	 * @param selector A query describing the documents to find
	 */
	async findWithCursor(
		_selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		_options?: FindOptions<DBInterface>
	): Promise<MongoCursor<DBInterface>> {
		throw new Error('findWithCursor not supported in tests')
	}

	observeChanges(
		_selector: MongoQuery<DBInterface> | DBInterface['_id'],
		_callbacks: ObserveChangesCallbacks<DBInterface>,
		_options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		throw new Error('observeChanges not supported in tests')
	}

	observe(
		_selector: MongoQuery<DBInterface> | DBInterface['_id'],
		_callbacks: ObserveCallbacks<DBInterface>,
		_options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		throw new Error('observe not supported in tests')
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

	async countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number> {
		await this.realSleep(0)
		try {
			return this._collection.find((selector ?? {}) as any, options as any).count()
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}
