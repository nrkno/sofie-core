import { MongoModifier, MongoQuery } from '../../../lib/typings/meteor'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import {
	UpdateOptions,
	UpsertOptions,
	FindOptions,
	MongoCursor,
	ObserveChangesCallbacks,
	ObserveCallbacks,
} from '../../../lib/collections/lib'
import { PromisifyCallbacks } from '../../../lib/lib'
import type { AnyBulkWriteOperation } from 'mongodb'
import _ from 'underscore'
import { AsyncOnlyMongoCollection } from '../collection'
import { WrappedMongoCollectionBase, dePromiseObjectOfFunctions } from './base'

/** This is for the mock mongo collection, as internally it is sync and so we dont need or want to play around with fibers */
export class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
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

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	async findFetchAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
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
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector, options).observeChanges(dePromiseObjectOfFunctions(callbacks))
	}

	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector, options).observe(dePromiseObjectOfFunctions(callbacks))
	}

	async insertAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		await this.realSleep(0)
		return this.insert(doc)
	}

	async insertManyAsync(docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
		await this.realSleep(0)
		return Promise.all(docs.map((doc) => this.insert(doc)))
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
