import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import {
	MongoReadOnlyCollection,
	MongoCursor,
	FindOptions,
	FindOneOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { getOrCreateMongoCollection } from '../../collections/collection'

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
