import { ICollection, MongoModifier, MongoQuery } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { isProtectedString, ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')
import { clone, deleteAllUndefinedProperties, getRandomId } from '@sofie-automation/corelib/dist/lib'
import {
	FindOneOptions,
	FindOptions,
	mongoFindOptions,
	mongoModify,
	mongoWhere,
} from '@sofie-automation/corelib/dist/mongo'
import { AnyBulkWriteOperation } from 'mongodb'
import { IS_PRODUCTION } from '../environment'
import { logger } from '../logging'
import { Changes, ChangedIds } from '../db/changes'
import { JobContext } from '../jobs'

type SelectorFunction<TDoc> = (doc: TDoc) => boolean
type DbCacheCollectionDocument<TDoc> = {
	inserted?: boolean
	updated?: boolean

	document: TDoc
} | null // removed

/** Caches data, allowing reads from cache, but not writes */
export class DbCacheReadCollection<TDoc extends { _id: ProtectedString<any> }> {
	documents = new Map<TDoc['_id'], DbCacheCollectionDocument<TDoc>>()
	protected originalDocuments: ReadonlyDeep<Array<TDoc>> = []

	// Set when the whole cache is to be removed from the db, to indicate that writes are not valid and will be ignored
	protected isToBeRemoved = false

	protected constructor(protected readonly context: JobContext, protected readonly _collection: ICollection<TDoc>) {
		//
	}

	public static createFromArray<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		docs: TDoc[] | ReadonlyDeep<Array<TDoc>>
	): DbCacheReadCollection<TDoc> {
		const col = new DbCacheReadCollection(context, collection)
		col.fillWithDataFromArray(docs as any)
		return col
	}
	public static async createFromDatabase<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		selector: MongoQuery<TDoc>
	): Promise<DbCacheReadCollection<TDoc>> {
		const span = context.startSpan('DbCacheReadCollection.createFromDatabase')
		if (span) {
			span.addLabels({
				collection: collection.name,
				query: JSON.stringify(selector),
			})
		}

		const docs = await collection.findFetch(selector)

		const res = DbCacheReadCollection.createFromArray(context, collection, docs)
		if (span) span.end()
		return res
	}

	get name(): string | null {
		return this._collection.name
	}

	findFetch(selector: MongoQuery<TDoc> | TDoc['_id'] | SelectorFunction<TDoc>, options?: FindOptions<TDoc>): TDoc[] {
		const span = this.context.startSpan(`DBCache.findFetch.${this.name}`)

		selector = selector || {}
		if (isProtectedString(selector)) {
			selector = { _id: selector } as MongoQuery<TDoc>
		}

		let docsToSearch = this.documents
		if (
			selector &&
			typeof selector === 'object' &&
			'_id' in selector &&
			selector['_id'] &&
			isProtectedString(selector['_id'])
		) {
			// Optimization: Make the lookup as small as possible:
			docsToSearch = new Map()
			const doc = this.documents.get(selector['_id'])
			if (doc) {
				docsToSearch.set(selector['_id'], doc)
			}
		}

		const results: TDoc[] = []
		docsToSearch.forEach((doc, _id) => {
			if (doc === null) return
			if (
				!selector
					? true
					: isProtectedString(selector)
					? selector === (_id as any)
					: _.isFunction(selector)
					? selector(doc.document)
					: mongoWhere(doc.document, selector as any)
			) {
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
	findOne(
		selector: MongoQuery<TDoc> | TDoc['_id'] | SelectorFunction<TDoc>,
		options?: FindOneOptions<TDoc>
	): TDoc | undefined {
		return this.findFetch(selector, options)[0]
	}

	async fillWithDataFromDatabase(selector: MongoQuery<TDoc>): Promise<number> {
		const span = this.context.startSpan(`DBCache.fillWithDataFromDatabase.${this.name}`)
		const docs = await this._collection.findFetch(selector)

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
	/** Called by the Cache when the Cache is marked as to be removed. The collection is emptied and marked to reject any further updates */
	markForRemoval(): void {
		this.isToBeRemoved = true
		this.documents = new Map()
		this.originalDocuments = []
	}
}
/** Caches data, allowing writes that will later be committed to mongo */
export class DbCacheWriteCollection<TDoc extends { _id: ProtectedString<any> }> extends DbCacheReadCollection<TDoc> {
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

	public static createFromArray<TDoc extends { _id: ProtectedString<any> }>(
		context: JobContext,
		collection: ICollection<TDoc>,
		docs: TDoc[]
	): DbCacheWriteCollection<TDoc> {
		const col = new DbCacheWriteCollection(context, collection)
		col.fillWithDataFromArray(docs as any)
		return col
	}
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

		const docs = await collection.findFetch(selector)

		const res = DbCacheWriteCollection.createFromArray(context, collection, docs)
		if (span) span.end()
		return res
	}

	insert(doc: TDoc): TDoc['_id'] {
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
	remove(selector: MongoQuery<TDoc> | TDoc['_id'] | SelectorFunction<TDoc>): Array<TDoc['_id']> {
		this.assertNotToBeRemoved('remove')

		const span = this.context.startSpan(`DBCache.remove.${this.name}`)

		const removedIds: TDoc['_id'][] = []
		if (isProtectedString(selector)) {
			if (this.documents.get(selector)) {
				this.documents.set(selector, null)
				removedIds.push(selector)
			}
		} else {
			const docsToRemove = this.findFetch(selector)
			for (const doc of docsToRemove) {
				removedIds.push(doc._id)
				this.documents.set(doc._id, null)
			}
		}

		if (span) span.end()
		return removedIds
	}

	/**
	 * Update some documents
	 * @param selector Filter function or mongo query
	 * @param modifier
	 * @param forceUpdate If true, the diff will be skipped and the document will be marked as having changed
	 * @returns All the ids that matched the selector
	 */
	update(
		selector: MongoQuery<TDoc> | TDoc['_id'] | SelectorFunction<TDoc>,
		modifier: ((doc: TDoc) => TDoc) | MongoModifier<TDoc> = {},
		forceUpdate?: boolean
	): Array<TDoc['_id']> {
		this.assertNotToBeRemoved('update')

		const span = this.context.startSpan(`DBCache.update.${this.name}`)

		const selectorInModify: MongoQuery<TDoc> = _.isFunction(selector)
			? {}
			: isProtectedString(selector)
			? ({ _id: selector } as any)
			: selector

		const changedIds: Array<TDoc['_id']> = []
		_.each(this.findFetch(selector), (doc) => {
			const _id = doc._id

			const newDoc: TDoc = _.isFunction(modifier)
				? modifier(clone(doc))
				: mongoModify(selectorInModify as any, clone(doc), modifier as any)
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
			changedIds.push(_id)
		})
		if (span) span.end()
		return changedIds
	}

	/** Returns true if a doc was replace, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): boolean {
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

	async updateDatabaseWithData(): Promise<Changes> {
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

		const pBulkWriteResult = updates.length > 0 ? this._collection.bulkWrite(updates) : Promise.resolve()

		_.each(removedDocs, (_id) => {
			this.documents.delete(_id)
		})

		await pBulkWriteResult

		if (span) span.addLabels(changes)
		if (span) span.end()
		return changes
	}
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
