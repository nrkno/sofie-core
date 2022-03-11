import { clone, deleteAllUndefinedProperties, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { ICollection, MongoModifier } from '../db'
import { logger } from '../logging'
import { Changes } from '../db/changes'
import { IS_PRODUCTION } from '../environment'
import _ = require('underscore')
import { mongoModify } from '@sofie-automation/corelib/dist/mongo'
import { JobContext } from '../jobs'

/**
 * Caches a single object, allowing reads from cache, but not writes
 * This should be used when the cache can only have one of something, and that must exist
 */
export class DbCacheReadObject<TDoc extends { _id: ProtectedString<any> }, DocOptional extends boolean = false> {
	protected _document: TDoc
	protected _rawDocument: TDoc

	// Set when the whole cache is to be removed from the db, to indicate that writes are not valid and will be ignored
	protected isToBeRemoved = false

	protected constructor(
		protected readonly context: JobContext,
		protected readonly _collection: ICollection<TDoc>,
		// @ts-expect-error used for typings
		private readonly _optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	) {
		this._document = doc ? clone(doc as any) : doc
		this._rawDocument = clone(doc as any)
	}
	get name(): string | null {
		return this._collection.name
	}

	public static createFromDoc<TDoc extends { _id: ProtectedString<any> }, DocOptional extends boolean = false>(
		context: JobContext,
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	): DbCacheReadObject<TDoc, DocOptional> {
		return new DbCacheReadObject<TDoc, DocOptional>(context, collection, optional, doc)
	}

	public static async createFromDatabase<
		TDoc extends { _id: ProtectedString<any> },
		DocOptional extends boolean = false
	>(
		context: JobContext,
		collection: ICollection<TDoc>,
		optional: DocOptional,
		id: TDoc['_id']
	): Promise<DbCacheReadObject<TDoc, DocOptional>> {
		const span = context.startSpan('DbCacheReadObject.createFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				id: unprotectString(id),
			})
		}

		const doc = await collection.findOne(id)
		if (!doc && !optional) {
			throw new Error(
				`DbCacheReadObject population for "${collection['name']}" failed. Document "${id}" was not found`
			)
		}

		const res = DbCacheReadObject.createFromDoc<TDoc, DocOptional>(context, collection, optional, doc as any)
		if (span) span.end()
		return res
	}

	get doc(): DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc> {
		return this._document as any
	}

	/** Called by the Cache when the Cache is marked as to be removed. The collection is emptied and marked to reject any further updates */
	markForRemoval(): void {
		this.isToBeRemoved = true
	}
}

/**
 * Caches a single object, allowing reads and writes that will be later committed back to mongo
 * This should be used when the cache can only have one of something, and that must exist
 */
export class DbCacheWriteObject<
	TDoc extends { _id: ProtectedString<any> },
	DocOptional extends boolean = false
> extends DbCacheReadObject<TDoc, DocOptional> {
	private _updated = false

	constructor(
		context: JobContext,
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	) {
		super(context, collection, optional, doc)
	}

	public static createFromDoc<TDoc extends { _id: ProtectedString<any> }, DocOptional extends boolean = false>(
		context: JobContext,
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	): DbCacheWriteObject<TDoc, DocOptional> {
		return new DbCacheWriteObject<TDoc, DocOptional>(context, collection, optional, doc)
	}

	public static async createFromDatabase<
		TDoc extends { _id: ProtectedString<any> },
		DocOptional extends boolean = false
	>(
		context: JobContext,
		collection: ICollection<TDoc>,
		optional: DocOptional,
		id: TDoc['_id']
	): Promise<DbCacheWriteObject<TDoc, DocOptional>> {
		const span = context.startSpan('DbCacheWriteObject.createFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				id: unprotectString(id),
			})
		}

		const doc = await collection.findOne(id)
		if (!doc && !optional) {
			throw new Error(
				`DbCacheWriteObject population for "${collection['name']}" failed. Document "${id}" was not found`
			)
		}

		const res = DbCacheWriteObject.createFromDoc<TDoc, DocOptional>(context, collection, optional, doc as any)
		if (span) span.end()
		return res
	}

	protected assertNotToBeRemoved(methodName: string): void {
		if (this.isToBeRemoved) {
			const msg = `DbCacheWriteObject: got call to "${methodName} when cache has been flagged for removal"`
			if (IS_PRODUCTION) {
				logger.warn(msg)
			} else {
				throw new Error(msg)
			}
		}
	}

	update(modifier: ((doc: TDoc) => TDoc) | MongoModifier<TDoc>): boolean {
		this.assertNotToBeRemoved('update')

		const localDoc: ReadonlyDeep<TDoc> | undefined = this.doc
		if (!localDoc) throw new Error(`Error: The document does not yet exist`)

		const newDoc: TDoc = _.isFunction(modifier)
			? modifier(clone(localDoc))
			: mongoModify({}, clone(localDoc), modifier)

		if (unprotectString(newDoc._id) !== unprotectString(localDoc._id)) {
			throw new Error(`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`)
		}

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		if (!_.isEqual(this.doc, newDoc)) {
			this._document = newDoc

			this._updated = true
			return true
		}

		return false
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._updated && !this.isToBeRemoved) {
			const span = this.context.startSpan(`DbCacheWriteObject.updateDatabaseWithData.${this.name}`)

			const pUpdate = await this._collection.replace(this._document)
			if (!pUpdate) {
				throw new Error(`Failed to update`)
			}

			if (span) span.end()

			return {
				added: 0,
				updated: 1,
				removed: 0,
			}
		} else {
			return {
				added: 0,
				updated: 0,
				removed: 0,
			}
		}
	}

	discardChanges(): void {
		if (this.isModified()) {
			this._updated = false
			this._document = this._rawDocument ? clone(this._rawDocument) : this._rawDocument
		}
	}

	isModified(): boolean {
		return this._updated
	}
}

/**
 * Caches a single object, allowing reads and writes that will be later committed back to mongo. This variant allows the object to start off undefined
 * This should be used when the cache can only have one of something, and that must exist
 */
export class DbCacheWriteOptionalObject<TDoc extends { _id: ProtectedString<any> }> extends DbCacheWriteObject<
	TDoc,
	true
> {
	private _inserted = false

	constructor(context: JobContext, collection: ICollection<TDoc>, doc: ReadonlyDeep<TDoc> | undefined) {
		super(context, collection, true, doc)
	}

	public static createOptionalFromDoc<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		doc: ReadonlyDeep<TDoc> | undefined
	): DbCacheWriteOptionalObject<TDoc> {
		return new DbCacheWriteOptionalObject<TDoc>(context, collection, doc)
	}

	public static async createOptionalFromDatabase<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		id: TDoc['_id']
	): Promise<DbCacheWriteOptionalObject<TDoc>> {
		const span = context.startSpan('DbCacheWriteOptionalObject.createOptionalFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				id: unprotectString(id),
			})
		}

		const doc = await collection.findOne(id)

		const res = DbCacheWriteOptionalObject.createOptionalFromDoc<TDoc>(
			context,
			collection,
			doc as ReadonlyDeep<TDoc> | undefined
		)
		if (span) span.end()
		return res
	}

	replace(doc: TDoc): ReadonlyDeep<TDoc> {
		this.assertNotToBeRemoved('replace')

		this._inserted = true

		if (!doc._id) doc._id = getRandomId()

		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		this._document = newDoc

		return this._document as any
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._inserted && !this.isToBeRemoved) {
			const span = this.context.startSpan(`DbCacheWriteOptionalObject.updateDatabaseWithData.${this.name}`)

			await this._collection.replace(this._document)

			if (span) span.end()

			return {
				added: 1,
				updated: 0,
				removed: 0,
			}
		} else {
			return super.updateDatabaseWithData()
		}
	}
}
