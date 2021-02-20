import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { profiler } from '../profiler'
import { ReadonlyDeep } from 'type-fest'
import { ICollection, MongoModifier } from '../collection'

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
		protected readonly _collection: ICollection<TDoc>,
		private readonly _optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	) {
		this._document = (doc ? this._transform(clone(doc as any)) : doc) as any
		this._rawDocument = clone(doc as any)
	}
	get name(): string | null {
		return this._collection.name
	}

	public static createFromDoc<TDoc extends { _id: ProtectedString<any> }, DocOptional extends boolean = false>(
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	): DbCacheReadObject<TDoc, DocOptional> {
		return new DbCacheReadObject<TDoc, DocOptional>(collection, optional, doc)
	}

	public static async createFromDatabase<
		TDoc extends { _id: ProtectedString<any> },
		DocOptional extends boolean = false
	>(
		collection: ICollection<TDoc>,
		optional: DocOptional,
		id: TDoc['_id']
	): Promise<DbCacheReadObject<TDoc, DocOptional>> {
		const doc = await collection.findOne(id)
		if (!doc && !optional) {
			throw new Error(
				`DbCacheReadObject population for "${collection['name']}" failed. Document "${id}" was not found`
			)
		}

		return DbCacheReadObject.createFromDoc<TDoc, DocOptional>(collection, optional, doc as any)
	}

	get doc(): DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc> {
		return this._document as any
	}

	protected _transform(doc: TDoc): TDoc {
		// @ts-ignore hack: using internal function in collection
		const transform = this._collection._transform
		if (transform) {
			return transform(doc)
		} else return doc as TDoc
	}

	/** Called by the Cache when the Cache is marked as to be removed. The collection is emptied and marked to reject any further updates */
	markForRemoval() {
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
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	) {
		super(collection, optional, doc)
	}

	public static createFromDoc<TDoc extends { _id: ProtectedString<any> }, DocOptional extends boolean = false>(
		collection: ICollection<TDoc>,
		optional: DocOptional,
		doc: DocOptional extends true ? ReadonlyDeep<TDoc> | undefined : ReadonlyDeep<TDoc>
	): DbCacheWriteObject<TDoc, DocOptional> {
		return new DbCacheWriteObject<TDoc, DocOptional>(collection, optional, doc)
	}

	public static async createFromDatabase<
		TDoc extends { _id: ProtectedString<any> },
		DocOptional extends boolean = false
	>(
		collection: ICollection<TDoc>,
		optional: DocOptional,
		id: TDoc['_id']
	): Promise<DbCacheWriteObject<TDoc, DocOptional>> {
		const doc = await collection.findOne(id)
		if (!doc && !optional) {
			throw new Error(
				`DbCacheWriteObject population for "${collection['name']}" failed. Document "${id}" was not found`
			)
		}

		return DbCacheWriteObject.createFromDoc<TDoc, DocOptional>(collection, optional, doc as any)
	}

	protected assertNotToBeRemoved(methodName: string): void {
		if (this.isToBeRemoved) {
			const msg = `DbCacheWriteObject: got call to "${methodName} when cache has been flagged for removal"`
			if (Meteor.isProduction) {
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
			this._document = this._transform(newDoc)

			this._updated = true
			return true
		}

		return false
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._updated && !this.isToBeRemoved) {
			const span = profiler.startSpan(`DbCacheWriteObject.updateDatabaseWithData.${this.name}`)

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

	discardChanges() {
		if (this.isModified()) {
			this._updated = false
			this._document = this._rawDocument ? this._transform(clone(this._rawDocument)) : this._rawDocument
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

	constructor(collection: ICollection<TDoc>, doc: ReadonlyDeep<TDoc> | undefined) {
		super(collection, true, doc)
	}

	public static createOptionalFromDoc<TDoc extends { _id: ProtectedString<any> }>(
		collection: ICollection<TDoc>,
		doc: ReadonlyDeep<TDoc> | undefined
	): DbCacheWriteOptionalObject<TDoc> {
		return new DbCacheWriteOptionalObject<TDoc>(collection, doc)
	}

	public static async createOptionalFromDatabase<TDoc extends { _id: ProtectedString<any> }>(
		collection: ICollection<TDoc>,
		id: TDoc['_id']
	): Promise<DbCacheWriteOptionalObject<TDoc>> {
		const doc = await collection.findOne(id)

		return DbCacheWriteOptionalObject.createOptionalFromDoc<TDoc>(collection, doc as ReadonlyDeep<TDoc> | undefined)
	}

	replace(doc: TDoc): ReadonlyDeep<TDoc> {
		this.assertNotToBeRemoved('replace')

		this._inserted = true

		if (!doc._id) doc._id = getRandomId()

		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		this._document = this._transform(newDoc)

		return this._document as any
	}

	async updateDatabaseWithData(): Promise<Changes> {
		if (this._inserted && !this.isToBeRemoved) {
			const span = profiler.startSpan(`DbCacheWriteOptionalObject.updateDatabaseWithData.${this.name}`)

			await this._collection.upsert(this._document._id, this._document)

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
