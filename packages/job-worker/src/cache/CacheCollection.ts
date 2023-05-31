import { ICollection, IMongoTransaction, IReadOnlyCollection, MongoQuery } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { isProtectedString, ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')
import { clone, deleteAllUndefinedProperties, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { FindOneOptions, FindOptions, mongoFindOptions } from '@sofie-automation/corelib/dist/mongo'
import { AnyBulkWriteOperation } from 'mongodb'
import { IS_PRODUCTION } from '../environment'
import { logger } from '../logging'
import { Changes, ChangedIds } from '../db/changes'
import { JobContext } from '../jobs'

export type SelectorFunction<TDoc extends { _id: ProtectedString<any> }> = (doc: TDoc) => boolean
type DbCacheCollectionDocument<TDoc> = {
	inserted?: boolean
	updated?: boolean

	document: TDoc
} | null // removed

/** Caches data, allowing reads from cache, but not writes */
export class DbCacheReadCollection<TDoc extends { _id: ProtectedString<any> }> {
	documents = new Map<TDoc['_id'], DbCacheCollectionDocument<TDoc>>()
	protected originalDocuments: ReadonlyDeep<Array<TDoc>> = []

	/**
	 * Whether this cache has been disposed of and is no longer valid for use
	 */
	protected _disposed = false

	protected constructor(
		protected readonly context: JobContext,
		protected readonly _collection: IReadOnlyCollection<TDoc>
	) {}

	/**
	 * Create a DbCacheReadCollection for existing documents
	 * @param context Context of the job
	 * @param collection Mongo collection the documents belongs to
	 * @param docs The documents
	 * @returns DbCacheReadCollection containing the provided documents
	 */
	public static createFromArray<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: IReadOnlyCollection<TDoc>,
		docs: TDoc[] | ReadonlyDeep<Array<TDoc>>
	): DbCacheReadCollection<TDoc> {
		const col = new DbCacheReadCollection(context, collection)
		col.fillWithDataFromArray(docs as any)
		return col
	}

	/**
	 * Load an array of object from Mongodb and create a DbCacheReadCollection for the documents
	 * Note: Make sure to use an appropriate selector to limit to documents allowed for the current context
	 * @param context Context of the job
	 * @param collection Mongo collection to load documents from
	 * @param selector Mongo selector to use to load documents
	 * @returns DbCacheReadCollection containing the loaded documents
	 */
	public static async createFromDatabase<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: IReadOnlyCollection<TDoc>,
		selector: MongoQuery<TDoc>
	): Promise<DbCacheReadCollection<TDoc>> {
		const span = context.startSpan('DbCacheReadCollection.createFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				query: JSON.stringify(selector),
			})
		}

		const docs = await collection.findFetch(selector, undefined, null)

		const res = DbCacheReadCollection.createFromArray(context, collection, docs)
		if (span) span.end()
		return res
	}

	get name(): string | null {
		return this._collection.name
	}

	/**
	 * Find documents matching a criteria
	 * @param selector selector function to match documents, or null to fetch all documents
	 * @param options
	 * @returns The matched documents
	 */
	findAll(selector: SelectorFunction<TDoc> | null, options?: FindOptions<TDoc>): TDoc[] {
		this.assertNotDisposed()

		const span = this.context.startSpan(`DBCache.findAll.${this.name}`)

		const results: TDoc[] = []
		this.documents.forEach((doc, _id) => {
			if (doc === null) return
			if (selector === null || selector(doc.document)) {
				if (doc.document['_id'] !== _id) {
					throw new Error(`Error: document._id "${doc.document['_id']}" is not equal to the key "${_id}"`)
				}
				results.push(doc.document)
			}
		})

		const res = mongoFindOptions(results, options)
		if (span) span.end()
		return res
	}

	/**
	 * Find a single document
	 * @param selector Id or selector function
	 * @param options
	 * @returns The first matched document, if any
	 */
	findOne(selector: TDoc['_id'] | SelectorFunction<TDoc>, options?: FindOneOptions<TDoc>): TDoc | undefined {
		this.assertNotDisposed()

		if (isProtectedString(selector)) {
			const span = this.context.startSpan(`DBCache.findOne.${this.name}`)
			const doc = this.documents.get(selector)
			if (doc) {
				const res = mongoFindOptions([doc.document], options)
				if (span) span.end()
				return res[0]
			} else {
				return undefined
			}
		} else {
			return this.findAll(selector, options)[0]
		}
	}

	async fillWithDataFromDatabase(selector: MongoQuery<TDoc>): Promise<number> {
		this.assertNotDisposed()

		const span = this.context.startSpan(`DBCache.fillWithDataFromDatabase.${this.name}`)
		const docs = await this._collection.findFetch(selector, undefined, null)

		span?.addLabels({ count: docs.length })

		this.fillWithDataFromArray(docs as any)
		span?.end()
		return docs.length
	}
	/**
	 * Populate this cache with an array of documents.
	 * Note: By default this wipes the current collection first
	 * @param documents The documents to store
	 */
	fillWithDataFromArray(documents: ReadonlyDeep<Array<TDoc>>, append = false): void {
		this.assertNotDisposed()

		if (append) {
			this.originalDocuments = this.originalDocuments.concat(documents)
		} else {
			this.originalDocuments = documents
			this.documents = new Map()
		}
		_.each(documents, (doc) => {
			const id = doc._id
			if (this.documents.has(id)) {
				throw new Error(
					`Unable to fill cache with data "${this._collection['name']}", _id "${doc._id}" already exists`
				)
			}

			this.documents.set(id, { document: clone(doc) })
		})
	}

	protected assertNotDisposed(): void {
		if (this._disposed) throw new Error(`CacheObject from "${this._collection.name}" has been disposed`)
	}

	/**
	 * Discards all documents in this cache, and marks it as unusable
	 */
	dispose(): void {
		this._disposed = false

		// Force delete the documents
		this.documents = new Map()
		this.originalDocuments = []
	}
}
/** Caches data, allowing writes that will later be committed to mongo */
export class DbCacheWriteCollection<TDoc extends { _id: ProtectedString<any> }> extends DbCacheReadCollection<TDoc> {
	// Set when the whole cache is to be removed from the db, to indicate that writes are not valid and will be ignored
	protected isToBeRemoved = false

	protected constructor(context: JobContext, protected readonly _collection: ICollection<TDoc>) {
		super(context, _collection)
	}

	protected assertNotToBeRemoved(methodName: string): void {
		if (this.isToBeRemoved) {
			const msg = `DbCacheWriteCollection: got call to "${methodName} when cache has been flagged for removal"`
			if (IS_PRODUCTION) {
				logger.warn(msg)
			} else {
				throw new Error(msg)
			}
		}
	}

	/**
	 * Create a DbCacheWriteCollection for existing documents
	 * @param context Context of the job
	 * @param collection Mongo collection the documents belongs to
	 * @param docs The documents
	 * @returns DbCacheWriteCollection containing the provided documents
	 */
	public static createFromArray<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		docs: TDoc[]
	): DbCacheWriteCollection<TDoc> {
		const col = new DbCacheWriteCollection(context, collection)
		col.fillWithDataFromArray(docs as any)
		return col
	}

	/**
	 * Load an array of object from Mongodb and create a DbCacheWriteCollection for the documents
	 * Note: Make sure to use an appropriate selector to limit to documents allowed for the current context
	 * @param context Context of the job
	 * @param collection Mongo collection to load documents from
	 * @param selector Mongo selector to use to load documents
	 * @returns DbCacheWriteCollection containing the loaded documents
	 */
	public static async createFromDatabase<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		selector: MongoQuery<TDoc>
	): Promise<DbCacheWriteCollection<TDoc>> {
		const span = context.startSpan('DbCacheWriteCollection.createFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				query: JSON.stringify(selector),
			})
		}

		const docs = await collection.findFetch(selector, undefined, null)

		const res = DbCacheWriteCollection.createFromArray(context, collection, docs)
		if (span) span.end()
		return res
	}

	/**
	 * Insert a single document
	 * @param doc The document to insert
	 * @returns The id of the inserted document
	 */
	insert(doc: TDoc): TDoc['_id'] {
		this.assertNotDisposed()
		this.assertNotToBeRemoved('insert')

		const span = this.context.startSpan(`DBCache.insert.${this.name}`)

		const existing = doc._id && this.documents.get(doc._id)
		if (existing) {
			throw new Error(`Error in cache insert to "${this.name}": _id "${doc._id}" already exists`)
		}
		if (!doc._id) doc._id = getRandomId()
		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		this.documents.set(doc._id, {
			inserted: existing !== null,
			updated: existing === null,
			document: newDoc,
		})
		if (span) span.end()
		return doc._id
	}

	/**
	 * Remove one or more documents
	 * @param selector Id of the document to update, a function to check each document, or null to remove all
	 * @returns The ids of the removed documents
	 */
	remove(selector: TDoc['_id'] | SelectorFunction<TDoc> | null): Array<TDoc['_id']> {
		this.assertNotDisposed()
		this.assertNotToBeRemoved('remove')

		const span = this.context.startSpan(`DBCache.remove.${this.name}`)

		const removedIds: TDoc['_id'][] = []
		if (isProtectedString(selector)) {
			if (this.documents.get(selector)) {
				this.documents.set(selector, null)
				removedIds.push(selector)
			}
		} else {
			const docsToRemove = this.findAll(selector)
			for (const doc of docsToRemove) {
				removedIds.push(doc._id)
				this.documents.set(doc._id, null)
			}
		}

		if (span) span.end()
		return removedIds
	}

	/**
	 * Update a single document
	 * @param selector Id of the document to update
	 * @param modifier The modifier to apply to the document. Return false to report the document as unchanged
	 * @param forceUpdate If true, the diff will be skipped and the document will be marked as having changed if the modifer returned a doc
	 * @returns The id of the updated document, if it was updated
	 */
	updateOne(
		selector: TDoc['_id'],
		modifier: (doc: TDoc) => TDoc | false,
		forceUpdate?: boolean
	): TDoc['_id'] | undefined {
		this.assertNotDisposed()
		this.assertNotToBeRemoved('updateOne')

		const span = this.context.startSpan(`DBCache.update.${this.name}`)

		if (!isProtectedString(selector)) throw new Error('DBCacheCollection.update expects an id as the selector')

		const doc = this.documents.get(selector)

		let result: TDoc['_id'] | undefined
		if (doc) {
			const _id = doc.document._id

			const newDoc = modifier(clone(doc.document))
			if (newDoc) {
				if (newDoc._id !== _id) {
					throw new Error(
						`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
					)
				}

				// ensure no properties are 'undefined'
				deleteAllUndefinedProperties(newDoc)

				const docEntry = this.documents.get(_id)
				if (!docEntry) {
					throw new Error(
						`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
					)
				}

				const hasPendingChanges = docEntry.inserted || docEntry.updated // If the doc is already dirty, then there is no point trying to diff it
				if (forceUpdate || hasPendingChanges || !_.isEqual(doc, newDoc)) {
					docEntry.document = newDoc
					docEntry.updated = true
				}
				result = _id
			}
		}

		if (span) span.end()
		return result
	}

	/**
	 * Update multiple documents
	 * @param modifier The modifier to apply to all the documents. Return false to report a document as unchanged
	 * @param forceUpdate If true, the diff will be skipped and the document will be marked as having changed
	 * @returns All the ids that were changed
	 */
	updateAll(modifier: (doc: TDoc) => TDoc | false, forceUpdate?: boolean): Array<TDoc['_id']> {
		this.assertNotDisposed()
		this.assertNotToBeRemoved('updateAll')

		const span = this.context.startSpan(`DBCache.updateAll.${this.name}`)

		const changedIds: Array<TDoc['_id']> = []
		this.documents.forEach((doc, _id) => {
			if (doc === null) return
			const newDoc: TDoc | false = modifier(clone(doc.document))
			if (newDoc === false) {
				// Function reports no change
				return
			}

			if (newDoc._id !== _id) {
				throw new Error(
					`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
				)
			}

			// ensure no properties are 'undefined'
			deleteAllUndefinedProperties(newDoc)

			const docEntry = this.documents.get(_id)
			if (!docEntry) {
				throw new Error(
					`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
				)
			}

			const hasPendingChanges = docEntry.inserted || docEntry.updated // If the doc is already dirty, then there is no point trying to diff it
			if (forceUpdate || hasPendingChanges || !_.isEqual(doc, newDoc)) {
				docEntry.document = newDoc
				docEntry.updated = true

				changedIds.push(_id)
			}
		})

		if (span) span.end()
		return changedIds
	}

	/**
	 * Replace a single document
	 * @param doc The document to insert
	 * @returns True if the document was replaced, false if it was inserted
	 */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): boolean {
		this.assertNotDisposed()
		this.assertNotToBeRemoved('replace')

		const span = this.context.startSpan(`DBCache.replace.${this.name}`)
		span?.addLabels({ id: unprotectString(doc._id) })

		if (!doc._id) throw new Error(`Error: The (immutable) field '_id' must be defined: "${doc._id}"`)
		const _id = doc._id

		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		const oldDoc = this.documents.get(_id)
		if (oldDoc) {
			oldDoc.updated = true
			oldDoc.document = newDoc
		} else {
			this.documents.set(_id, {
				inserted: true,
				document: newDoc,
			})
		}

		if (span) span.end()
		return !!oldDoc
	}

	/**
	 * Write the changed documents to mongo
	 * @returns Changes object describing the saved changes
	 */
	async updateDatabaseWithData(transaction: IMongoTransaction | null): Promise<Changes> {
		this.assertNotDisposed()

		const span = this.context.startSpan(`DBCache.updateDatabaseWithData.${this.name}`)
		const changes: {
			added: number
			updated: number
			removed: number
		} = {
			added: 0,
			updated: 0,
			removed: 0,
		}

		if (this.isToBeRemoved) {
			// Nothing to save
			return changes
		}

		const updates: AnyBulkWriteOperation<TDoc>[] = []
		const removedDocs: TDoc['_id'][] = []
		this.documents.forEach((doc, id) => {
			if (doc === null) {
				removedDocs.push(id)
				changes.removed++
			} else {
				if (doc.inserted) {
					updates.push({
						replaceOne: {
							filter: {
								_id: id,
							},
							replacement: doc.document,
							upsert: true,
						},
					})
					changes.added++
				} else if (doc.updated) {
					updates.push({
						replaceOne: {
							filter: {
								_id: id,
							},
							replacement: doc.document,
						},
					})
					changes.updated++
				}
				delete doc.inserted
				delete doc.updated
			}
		})
		if (removedDocs.length) {
			updates.push({
				deleteMany: {
					filter: {
						_id: { $in: removedDocs as any },
					},
				},
			})
		}

		const pBulkWriteResult =
			updates.length > 0 ? this._collection.bulkWrite(updates, transaction) : Promise.resolve()

		_.each(removedDocs, (_id) => {
			this.documents.delete(_id)
		})

		await pBulkWriteResult

		if (span) span.addLabels(changes)
		if (span) span.end()
		return changes
	}

	/**
	 * Called to mark all the objects in this collection as pending deletion from mongo. This will cause it to reject any future updates
	 * Note: The actual deletion must be handled elsewhere
	 */
	markForRemoval(): void {
		this.isToBeRemoved = true
		this.documents = new Map()
		this.originalDocuments = []
	}

	/**
	 * Discard any changes that have been made locally to the collection.
	 * Restores the documents as provided when this wrapper was created
	 */
	discardChanges(): void {
		if (this.isModified()) {
			this.fillWithDataFromArray(this.originalDocuments)
		}
	}

	/**
	 * Write all the documents in this cache into another. This assumes that this cache is a subset of the other and was populated with a subset of its data
	 * @param otherCache The cache to update
	 */
	updateOtherCacheWithData(otherCache: DbCacheWriteCollection<TDoc>): ChangedIds<TDoc['_id']> {
		this.assertNotDisposed()

		const changes: ChangedIds<TDoc['_id']> = {
			added: [],
			updated: [],
			removed: [],
			unchanged: [],
		}

		this.documents.forEach((doc, id) => {
			if (doc === null) {
				otherCache.remove(id)
				this.documents.delete(id)
				changes.removed.push(id)
			} else {
				if (doc.inserted) {
					otherCache.replace(doc.document)

					changes.added.push(id)
				} else if (doc.updated) {
					otherCache.replace(doc.document)

					changes.updated.push(id)
				} else {
					changes.unchanged.push(id)
				}
				delete doc.inserted
				delete doc.updated
			}
		})

		return changes
	}

	isModified(): boolean {
		for (const doc of Array.from(this.documents.values())) {
			if (doc === null || doc.inserted || doc.updated) {
				return true
			}
		}
		return false
	}
}
