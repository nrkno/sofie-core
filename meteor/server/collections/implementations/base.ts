import { MongoModifier, MongoQuery } from '../../../lib/typings/meteor'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { UpdateOptions, UpsertOptions, FindOptions, IndexSpecifier, MongoCursor } from '../../../lib/collections/lib'
import type { Collection as RawCollection, Db as RawDb, CreateIndexesOptions } from 'mongodb'
import { stringifyError } from '@sofie-automation/corelib/dist/lib'
import { PromisifyCallbacks, waitForPromise } from '../../../lib/lib'

export class WrappedMongoCollectionBase<DBInterface extends { _id: ProtectedString<any> }> {
	protected readonly _collection: Mongo.Collection<DBInterface>

	public readonly name: string | null

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		this._collection = collection
		this.name = name
	}

	protected get _isMock(): boolean {
		// @ts-expect-error re-export private property
		return this._collection._isMock
	}

	public get mockCollection(): Mongo.Collection<DBInterface> {
		return this._collection
	}

	protected wrapMongoError(e: unknown): never {
		const str = stringifyError(e) || 'Unknown MongoDB Error'
		throw new Meteor.Error(e instanceof Meteor.Error ? e.error : 500, `Collection "${this.name}": ${str}`)
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

export function dePromiseObjectOfFunctions<T extends { [k: string]: Function }>(input: PromisifyCallbacks<T>): T {
	return Object.fromEntries(
		Object.entries<any>(input).map(([id, fn]) => {
			const fn2 = (...args: any[]) => {
				try {
					return waitForPromise(fn(...args))
				} catch (e) {
					console.trace(e)
					throw e
				}
			}

			return [id, fn2]
		})
	) as any
}
