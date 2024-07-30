import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { ProtectedString, protectString } from '../lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import type { Collection as RawCollection, Db as RawDb } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MongoModifier, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import {
	MongoCollection,
	MongoReadOnlyCollection,
	MongoCursor,
	FindOptions,
	FindOneOptions,
	UpdateOptions,
	UpsertOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'

export * from '@sofie-automation/meteor-lib/dist/collections/lib'

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
 * Create a Mongo Collection for use in the client (has sync apis)
 * @param name Name of the collection
 */
export function createSyncMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): MongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)
	const wrapped = new WrappedMongoCollection<DBInterface>(collection, name)

	// registerClientCollection(name, wrapped)

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

	// registerClientCollection(name, wrapped)

	return wrapped
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
		const str = stringifyError(e) || 'Unknown MongoDB Error'
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
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | { _id: DBInterface['_id'] },
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
}
