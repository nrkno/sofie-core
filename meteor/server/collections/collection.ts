import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoModifier, MongoQuery } from '../../lib/typings/meteor'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import {
	UpdateOptions,
	UpsertOptions,
	WrappedMongoCollection,
	MongoCollection,
	FieldNames,
	getOrCreateMongoCollection,
	FindOptions,
	collectionsCache,
	IndexSpecifier,
} from '../../lib/collections/lib'
import { makePromise, stringifyError, waitForPromise } from '../../lib/lib'
import type { AnyBulkWriteOperation, Collection as RawCollection, CreateIndexesOptions } from 'mongodb'
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
): ServerMongoCollection<DBInterface> {
	if (collectionsCache.has(name)) throw new Meteor.Error(500, `Collection "${name}" has already been created`)
	collectionsCache.set(name, collection)

	return new WrappedServerMongoCollection<DBInterface>(collection, name)
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param options Open options
 */
export function createAsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
	// options?: {
	// 	connection?: Object | null
	// 	idGeneration?: string
	// }
): ServerMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	let collection2: ServerMongoCollection<DBInterface>
	if ((collection as any)._isMock) {
		collection2 = new WrappedMockCollection(collection, name)
	} else {
		// Override the default mongodb methods, because the errors thrown by them doesn't contain the proper call stack
		collection2 = new WrappedServerMongoCollection(collection, name)
	}

	registerCollection(name, collection2)

	return collection2
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
): ServerAsyncOnlyMongoCollection<DBInterface> {
	// TODO - this should be using a different class
	return createAsyncMongoCollection(name)
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

export interface ServerAsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends AsyncOnlyMongoCollection<DBInterface> {
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

export interface ServerMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends ServerAsyncOnlyMongoCollection<DBInterface>,
		MongoCollection<DBInterface> {}

class WrappedServerMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedAsyncMongoCollection<DBInterface>
	implements ServerMongoCollection<DBInterface>
{
	allow(args: Parameters<ServerMongoCollection<DBInterface>['allow']>[0]): boolean {
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
	deny(args: Parameters<ServerMongoCollection<DBInterface>['deny']>[0]): boolean {
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
 * A minimal Async wrapping around the base Mongo.Collection type
 */
export interface AsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends MongoCollection<DBInterface>,
		AsyncOnlyMongoCollection<DBInterface> {}
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

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollection<DBInterface>
	implements ServerMongoCollection<DBInterface>
{
	private readonly realSleep: (time: number) => Promise<void>

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		super(collection, name)

		if (!this._isMock) throw new Meteor.Error(500, 'WrappedMockCollection is only valid for a mock collection')

		const realSleep = (Meteor as any).sleepNoFakeTimers
		if (!realSleep) throw new Error('Missing Meteor.sleepNoFakeTimers, looks like the mock is broken?')
		this.realSleep = realSleep
	}

	allow(args: Parameters<ServerMongoCollection<DBInterface>['allow']>[0]): boolean {
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
	deny(args: Parameters<ServerMongoCollection<DBInterface>['deny']>[0]): boolean {
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
