import { MongoModifier, MongoQuery } from '../../../lib/typings/meteor'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
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
import { PromisifyCallbacks, makePromise, waitForPromise } from '../../../lib/lib'
import type { AnyBulkWriteOperation } from 'mongodb'
import { WrappedMongoCollectionBase, dePromiseObjectOfFunctions } from './base'
import { AsyncOnlyMongoCollection } from '../collection'

export class WrappedAsyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedMongoCollectionBase<DBInterface>
	implements AsyncOnlyMongoCollection<DBInterface>
{
	async findFetchAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
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
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector as any, options).observeChanges(dePromiseObjectOfFunctions(callbacks))
	}

	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Meteor.LiveQueryHandle {
		return this.find(selector as any, options).observe(dePromiseObjectOfFunctions(callbacks))
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
