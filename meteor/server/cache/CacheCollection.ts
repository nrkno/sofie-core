import { ProtectedString, isProtectedString, mongoWhere, mongoFindOptions, protectString, clone } from '../../lib/lib'
import { MongoQuery, FindOptions, FindOneOptions } from '../../lib/typings/meteor'
import _ from 'underscore'
import { profiler } from '../api/profiler'
import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { AsyncTransformedCollection } from '../../lib/collections/lib'

type SelectorFunction<DBInterface> = (doc: DBInterface) => boolean
type DbCacheCollectionDocument<Class> = {
	inserted?: boolean
	updated?: boolean

	document: Class
} | null // removed

/** Caches data, allowing reads from cache, but not writes */
export class DbCacheReadCollection<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }> {
	documents = new Map<DBInterface['_id'], DbCacheCollectionDocument<Class>>()
	protected originalDocuments: ReadonlyDeep<Array<Class>> = []

	// Set when the whole cache is to be removed from the db, to indicate that writes are not valid and will be ignored
	protected isToBeRemoved = false

	protected constructor(protected _collection: AsyncTransformedCollection<Class, DBInterface>) {
		//
	}

	public static createFromArray<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }>(
		collection: AsyncTransformedCollection<Class, DBInterface>,
		docs: Class[] | ReadonlyDeep<Array<Class>>
	): DbCacheReadCollection<Class, DBInterface> {
		const col = new DbCacheReadCollection(collection)
		col.fillWithDataFromArray(docs as any)
		return col
	}
	public static async createFromDatabase<
		Class extends DBInterface,
		DBInterface extends { _id: ProtectedString<any> }
	>(
		collection: AsyncTransformedCollection<Class, DBInterface>,
		selector: MongoQuery<DBInterface>
	): Promise<DbCacheReadCollection<Class, DBInterface>> {
		const docs = await collection.findFetchAsync(selector)

		return DbCacheReadCollection.createFromArray(collection, docs)
	}

	get name(): string | null {
		return this._collection.name
	}

	findFetch(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		options?: FindOptions<DBInterface>
	): Class[] {
		const span = profiler.startSpan(`DBCache.findFetch.${this.name}`)

		selector = selector || {}
		if (isProtectedString(selector)) {
			selector = { _id: selector } as MongoQuery<DBInterface>
		}

		let docsToSearch = this.documents
		if (selector['_id'] && _.isString(selector['_id'])) {
			// Optimization: Make the lookup as small as possible:
			docsToSearch = new Map()
			const doc = this.documents.get(protectString(selector['_id']))
			if (doc) {
				docsToSearch.set(protectString(selector['_id']), doc)
			}
		}

		const results: Class[] = []
		docsToSearch.forEach((doc, _id) => {
			if (doc === null) return
			if (
				!selector
					? true
					: isProtectedString(selector)
					? selector === (_id as any)
					: _.isFunction(selector)
					? selector(doc.document)
					: mongoWhere(doc.document, selector)
			) {
				if (doc.document['_id'] !== _id) {
					throw new Meteor.Error(
						500,
						`Error: document._id "${doc.document['_id']}" is not equal to the key "${_id}"`
					)
				}
				results.push(doc.document)
			}
		})

		const res = mongoFindOptions(results, options as any)
		if (span) span.end()
		return res
	}
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		options?: FindOneOptions<DBInterface>
	): Class | undefined {
		return this.findFetch(selector, options)[0]
	}

	async fillWithDataFromDatabase(selector: MongoQuery<DBInterface>): Promise<number> {
		const span = profiler.startSpan(`DBCache.fillWithDataFromDatabase.${this.name}`)
		const docs = await this._collection.findFetchAsync(selector)

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
	fillWithDataFromArray(documents: ReadonlyDeep<Array<Class>>, append = false) {
		if (append) {
			this.originalDocuments = this.originalDocuments.concat(documents)
		} else {
			this.originalDocuments = documents
			this.documents = new Map()
		}
		_.each(documents, (doc) => {
			const id = doc._id
			if (this.documents.has(id)) {
				throw new Meteor.Error(
					500,
					`Unable to fill cache with data "${this._collection['name']}", _id "${doc._id}" already exists`
				)
			}

			this.documents.set(id, { document: this._transform(clone(doc)) })
		})
	}
	protected _transform(doc: DBInterface): Class {
		// @ts-ignore hack: using internal function in collection
		const transform = this._collection._transform
		if (transform) {
			return transform(doc)
		} else return doc as Class
	}

	/** Called by the Cache when the Cache is marked as to be removed. The collection is emptied and marked to reject any further updates */
	markForRemoval() {
		this.isToBeRemoved = true
		this.documents = new Map()
		this.originalDocuments = []
	}
}
