import {
	ProtectedString,
	waitForPromise,
	isProtectedString,
	mongoWhere,
	unprotectString,
	mongoFindOptions,
	asyncCollectionFindFetch,
	getRandomId,
	protectStringArray,
	mongoModify,
	Changes,
	protectString,
	asyncCollectionBulkWrite,
	clone,
} from '../../lib/lib'
import { MongoQuery, TransformedCollection, FindOptions, MongoModifier } from '../../lib/typings/meteor'
import _ from 'underscore'
import { profiler } from '../api/profiler'
import { Meteor } from 'meteor/meteor'
import { BulkWriteOperation } from 'mongodb'

type SelectorFunction<DBInterface> = (doc: DBInterface) => boolean
interface DbCacheCollectionDocument<Class> {
	inserted?: boolean
	updated?: boolean
	removed?: boolean

	document: Class
}

/** Caches data, allowing reads from cache, but not writes */
export class DbCacheReadCollection<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }> {
	documents: { [_id: string]: DbCacheCollectionDocument<Class> } = {}

	private _initialized: boolean = false
	private _initializer?: MongoQuery<DBInterface> | (() => Promise<void>) = undefined
	private _initializing: Promise<any> | undefined

	constructor(protected _collection: TransformedCollection<Class, DBInterface>) {
		//
	}
	get name(): string | undefined {
		return this._collection['name']
	}

	get initialized(): boolean {
		// If we have either loaded data, or are loading it then we should make any potential consumers use us
		return this._initialized || this._initializing !== undefined
	}

	prepareInit(initializer: MongoQuery<DBInterface> | (() => Promise<void>), initializeImmediately: boolean) {
		this._initializer = initializer
		if (initializeImmediately) {
			this._initialize()
		}
	}
	extendWithData(cacheCollection: DbCacheReadCollection<Class, DBInterface>) {
		this._initialized = cacheCollection._initialized
		this._initializer = cacheCollection._initializer
		_.each(cacheCollection.documents, (doc, key) => {
			if (!this.documents[key]) this.documents[key] = doc
		})
	}

	protected _initialize() {
		if (this._initializing) {
			// Only allow one fiber to run this at a time
			waitForPromise(this._initializing)
		}

		if (!this._initialized) {
			if (this._initializer !== undefined) {
				if (typeof this._initializer === 'function') {
					this._initializing = this._initializer()
				} else {
					this._initializing = this.fillWithDataFromDatabase(this._initializer)
				}
				waitForPromise(this._initializing)
				this._initializing = undefined
			}
			this._initialized = true
		}
	}

	findFetch(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		options?: FindOptions<DBInterface>
	): Class[] {
		const span = profiler.startSpan(`DBCache.findFetch.${this.name}`)
		this._initialize()

		selector = selector || {}
		if (isProtectedString(selector)) {
			selector = { _id: selector } as MongoQuery<DBInterface>
		}

		let docsToSearch = this.documents
		if (selector['_id'] && _.isString(selector['_id'])) {
			// Optimization: Make the lookup as small as possible:
			docsToSearch = {}
			const doc = this.documents[selector['_id']]
			if (doc) {
				docsToSearch[selector['_id']] = doc
			}
		}

		const results: Class[] = []
		_.each(docsToSearch, (doc, _id) => {
			if (doc.removed) return
			if (
				!selector
					? true
					: isProtectedString(selector)
					? selector === (_id as any)
					: _.isFunction(selector)
					? selector(doc.document)
					: mongoWhere(doc.document, selector)
			) {
				if (unprotectString(doc.document['_id']) !== _id) {
					throw new Meteor.Error(
						500,
						`Error: document._id "${doc.document['_id']}" is not equal to the key "${_id}"`
					)
				}
				results.push(doc.document)
			}
		})

		const res = mongoFindOptions(results, options)
		if (span) span.end()
		return res
	}
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		options?: FindOptions<DBInterface>
	): Class | undefined {
		this._initialize()

		return this.findFetch(selector, options)[0]
	}

	async fillWithDataFromDatabase(selector: MongoQuery<DBInterface>): Promise<number> {
		const docs = await asyncCollectionFindFetch(this._collection, selector)

		this._innerfillWithDataFromArray(docs)
		return docs.length
	}
	private _innerfillWithDataFromArray(documents: Class[]) {
		_.each(documents, (doc) => {
			const id = unprotectString(doc._id)
			if (this.documents[id]) {
				throw new Meteor.Error(
					500,
					`Unable to fill cache with data "${this._collection['name']}", _id "${doc._id}" already exists`
				)
			}

			this.documents[id] = {
				document: doc,
			}
		})
	}
	protected _transform(doc: DBInterface): Class {
		// @ts-ignore hack: using internal function in collection
		const transform = this._collection._transform
		if (transform) {
			return transform(doc)
		} else return doc as Class
	}
}
export class DbCacheWriteCollection<
	Class extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
> extends DbCacheReadCollection<Class, DBInterface> {
	insert(doc: DBInterface): DBInterface['_id'] {
		const span = profiler.startSpan(`DBCache.insert.${this.name}`)
		this._initialize()

		const existing = doc._id && this.documents[unprotectString(doc._id)]
		if (existing && !existing.removed) {
			throw new Meteor.Error(500, `Error in cache insert to "${this.name}": _id "${doc._id}" already exists`)
		}
		if (!doc._id) doc._id = getRandomId()
		this.documents[unprotectString(doc._id)] = {
			inserted: true,
			document: this._transform(clone(doc)), // Unlinke a normal collection, this class stores the transformed objects
		}
		if (span) span.end()
		return doc._id
	}
	remove(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>
	): Array<DBInterface['_id']> {
		const span = profiler.startSpan(`DBCache.remove.${this.name}`)
		this._initialize()

		let removedIds: DBInterface['_id'][] = []
		if (isProtectedString(selector)) {
			const oldDoc = this.documents[unprotectString(selector)]
			if (oldDoc && !oldDoc.removed) {
				oldDoc.removed = true
				delete oldDoc.document
				removedIds.push(selector)
			}
		} else {
			const idsToRemove = this.findFetch(selector).map((doc) => unprotectString(doc._id))
			_.each(idsToRemove, (id) => {
				this.documents[id].removed = true
				delete this.documents[id].document
			})
			removedIds = protectStringArray(idsToRemove)
		}

		if (span) span.end()
		return removedIds
	}
	update(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		modifier: ((doc: DBInterface) => DBInterface) | MongoModifier<DBInterface> = {},
		forceUpdate?: boolean
	): number {
		const span = profiler.startSpan(`DBCache.update.${this.name}`)
		this._initialize()

		const selectorInModify: MongoQuery<DBInterface> = _.isFunction(selector)
			? {}
			: isProtectedString(selector)
			? ({ _id: selector } as any)
			: selector

		let count = 0
		_.each(this.findFetch(selector), (doc) => {
			const _id = unprotectString(doc._id)

			let newDoc: DBInterface = _.isFunction(modifier)
				? modifier(clone(doc))
				: mongoModify(selectorInModify, clone(doc), modifier)
			if (unprotectString(newDoc._id) !== _id) {
				throw new Meteor.Error(
					500,
					`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
				)
			}

			if (forceUpdate || !_.isEqual(doc, newDoc)) {
				newDoc = this._transform(newDoc)

				_.each(_.uniq([..._.keys(newDoc), ..._.keys(doc)]), (key) => {
					doc[key] = newDoc[key]
				})
				this.documents[_id].updated = true
			}
			count++
		})
		if (span) span.end()
		return count
	}

	/** Returns true if a doc was replace, false if inserted */
	replace(doc: DBInterface): boolean {
		const span = profiler.startSpan(`DBCache.replace.${this.name}`)
		this._initialize()

		if (!doc._id) throw new Meteor.Error(500, `Error: The (immutable) field '_id' must be defined: "${doc._id}"`)
		const _id = unprotectString(doc._id)

		const oldDoc = this.documents[_id]
		if (oldDoc && !oldDoc.removed) {
			oldDoc.updated = true
			oldDoc.document = this._transform(doc)
		} else {
			this.documents[_id] = {
				inserted: true,
				document: this._transform(doc),
			}
		}

		if (span) span.end()
		return !!oldDoc
	}

	upsert(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		doc: DBInterface,
		forceUpdate?: boolean
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	} {
		const span = profiler.startSpan(`DBCache.upsert.${this.name}`)
		this._initialize()

		if (isProtectedString(selector)) {
			selector = { _id: selector } as any
		}

		const updatedCount = this.update(selector, doc, forceUpdate)
		if (updatedCount > 0) {
			if (span) span.end()
			return { numberAffected: updatedCount }
		} else {
			if (!selector['_id']) {
				throw new Meteor.Error(500, `Can't upsert without selector._id`)
			}
			if (doc._id !== selector['_id']) {
				throw new Meteor.Error(
					500,
					`Can't upsert, selector._id "${selector['_id']}" not matching doc._id "${doc._id}"`
				)
			}

			if (span) span.end()
			return { numberAffected: 1, insertedId: this.insert(doc) }
		}
	}
	async updateDatabaseWithData(): Promise<Changes> {
		const span = profiler.startSpan(`DBCache.updateDatabaseWithData.${this.name}`)
		const changes: {
			added: number
			updated: number
			removed: number
		} = {
			added: 0,
			updated: 0,
			removed: 0,
		}

		const updates: BulkWriteOperation<DBInterface>[] = []
		const removedDocs: Class['_id'][] = []
		_.each(this.documents, (doc, id) => {
			const _id: DBInterface['_id'] = protectString(id)
			if (doc.removed) {
				removedDocs.push(_id)
				changes.removed++
			} else if (doc.inserted) {
				updates.push({
					replaceOne: {
						filter: {
							_id: id as any,
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
							_id: id as any,
						},
						replacement: doc.document,
					},
				})
				changes.updated++
			}
			delete doc.inserted
			delete doc.updated
			// Note: we don't delete doc.removed, because that breaks this._collection[x].document
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

		const pBulkWriteResult = asyncCollectionBulkWrite(this._collection, updates)

		_.each(removedDocs, (_id) => {
			delete this._collection[unprotectString(_id)]
		})

		const writeResult = await pBulkWriteResult

		if (span) span.addLabels(changes)
		if (span) span.end()
		return changes
	}
}
