import { Meteor } from 'meteor/meteor'
import {
	ProtectedString,
	mongoWhere,
	isProtectedString,
	unprotectString,
	getRandomId,
	protectString,
	clone,
	asyncCollectionFindFetch,
	mongoModify,
	mongoFindOptions,
	DBObj,
	compareObjs,
	waitForPromise,
	asyncCollectionBulkWrite,
	PreparedChanges,
	Changes,
} from '../lib/lib'
import * as _ from 'underscore'
import { TransformedCollection, MongoModifier, FindOptions, MongoQuery } from '../lib/typings/meteor'
import { BulkWriteOperation } from 'mongodb'
import { profiler } from './api/profiler'

export function isDbCacheReadCollection(o: any): o is DbCacheReadCollection<any, any> {
	return !!(o && typeof o === 'object' && o.fillWithDataFromDatabase)
}
export function isDbCacheWriteCollection(o: any): o is DbCacheWriteCollection<any, any> {
	return !!(o && typeof o === 'object' && o.updateDatabaseWithData)
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

		this.fillWithDataFromArray(docs)
		return docs.length
	}
	fillWithDataFromArray(documents: Class[]) {
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
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>): number {
		const span = profiler.startSpan(`DBCache.remove.${this.name}`)
		this._initialize()

		let removed = 0
		if (isProtectedString(selector)) {
			const oldDoc = this.documents[unprotectString(selector)]
			if (oldDoc && !oldDoc.removed) {
				oldDoc.removed = true
				delete oldDoc.document
			}
		} else {
			const idsToRemove = this.findFetch(selector).map((doc) => unprotectString(doc._id))
			_.each(idsToRemove, (id) => {
				this.documents[id].removed = true
				delete this.documents[id].document
			})
			removed += idsToRemove.length
		}

		if (span) span.end()
		return removed
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

		await pBulkWriteResult

		if (span) span.addLabels(changes)
		if (span) span.end()
		return changes
	}
	updateOtherCacheWithData(otherCache: DbCacheWriteCollection<Class, DBInterface>) {
		for (const id of Object.keys(this.documents)) {
			const _id: DBInterface['_id'] = protectString(id)
			const doc = this.documents[id]

			if (doc.removed) {
				otherCache.remove(_id)
				delete this.documents[id]
			} else {
				if (doc.inserted) {
					otherCache.insert(doc.document)
				} else if (doc.updated) {
					otherCache.upsert(_id, doc.document, true)
				}
				delete doc.inserted
				delete doc.updated
			}
		}
	}
}
type SelectorFunction<DBInterface> = (doc: DBInterface) => boolean
interface DbCacheCollectionDocument<Class> {
	inserted?: boolean
	updated?: boolean
	removed?: boolean

	document: Class
}

interface SaveIntoDbOptions<DocClass, DBInterface> {
	beforeInsert?: (o: DBInterface) => DBInterface
	beforeUpdate?: (o: DBInterface, pre?: DocClass) => DBInterface
	beforeRemove?: (o: DocClass) => DBInterface
	beforeDiff?: (o: DBInterface, oldObj: DocClass) => DBInterface
	insert?: (o: DBInterface) => void
	update?: (o: DBInterface) => void
	remove?: (o: DBInterface) => void
	unchanged?: (o: DBInterface) => void
	afterInsert?: (o: DBInterface) => void
	afterUpdate?: (o: DBInterface) => void
	afterRemove?: (o: DBInterface) => void
	afterRemoveAll?: (o: Array<DBInterface>) => void
}
export function saveIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: DbCacheWriteCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	options?: SaveIntoDbOptions<DocClass, DBInterface>
): Changes {
	const span = profiler.startSpan(`DBCache.saveIntoCache.${collection.name}`)
	const preparedChanges = prepareSaveIntoCache(collection, filter, newData, options)

	if (span)
		span.addLabels({
			prepInsert: preparedChanges.inserted.length,
			prepChanged: preparedChanges.changed.length,
			prepRemoved: preparedChanges.removed.length,
			prepUnchanged: preparedChanges.unchanged.length,
		})

	const changes = savePreparedChangesIntoCache(preparedChanges, collection, options)

	if (span) span.addLabels(changes as any)
	if (span) span.end()
	return changes
}
export function prepareSaveIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: DbCacheWriteCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
): PreparedChanges<DBInterface> {
	const span = profiler.startSpan(`DBCache.prepareSaveIntoCache.${collection.name}`)

	let preparedChanges: PreparedChanges<DBInterface> = {
		inserted: [],
		changed: [],
		removed: [],
		unchanged: [],
	}

	const options: SaveIntoDbOptions<DocClass, DBInterface> = optionsOrg || {}

	const identifier = '_id'

	const newObjIds: { [identifier: string]: true } = {}
	_.each(newData, (o) => {
		if (newObjIds[o[identifier] as any]) {
			throw new Meteor.Error(
				500,
				`prepareSaveIntoCache into collection "${collection.name}": Duplicate identifier ${identifier}: "${o[identifier]}"`
			)
		}
		newObjIds[o[identifier] as any] = true
	})

	const oldObjs: Array<DocClass> = collection.findFetch(filter)

	const removeObjs: { [id: string]: DocClass } = {}
	_.each(oldObjs, (o: DocClass) => {
		if (removeObjs['' + o[identifier]]) {
			// duplicate id:
			preparedChanges.removed.push(o)
		} else {
			removeObjs['' + o[identifier]] = o
		}
	})

	_.each(newData, function(o) {
		const oldObj = removeObjs['' + o[identifier]]

		if (oldObj) {
			const o2 = options.beforeDiff ? options.beforeDiff(o, oldObj) : o
			const eql = compareObjs(oldObj, o2)

			if (!eql) {
				let oUpdate = options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o
				preparedChanges.changed.push(oUpdate)
			} else {
				preparedChanges.unchanged.push(oldObj)
			}
		} else {
			if (!_.isNull(oldObj)) {
				let oInsert = options.beforeInsert ? options.beforeInsert(o) : o
				preparedChanges.inserted.push(oInsert)
			}
		}
		delete removeObjs['' + o[identifier]]
	})
	_.each(removeObjs, function(obj: DocClass) {
		if (obj) {
			let oRemove: DBInterface = options.beforeRemove ? options.beforeRemove(obj) : obj
			preparedChanges.removed.push(oRemove)
		}
	})

	span?.end()
	return preparedChanges
}
export function savePreparedChangesIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	preparedChanges: PreparedChanges<DBInterface>,
	collection: DbCacheWriteCollection<DocClass, DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
) {
	const span = profiler.startSpan(`DBCache.savePreparedChangesIntoCache.${collection.name}`)

	let change: Changes = {
		added: 0,
		updated: 0,
		removed: 0,
	}
	const options: SaveIntoDbOptions<DocClass, DBInterface> = optionsOrg || {}

	const newObjIds: { [identifier: string]: true } = {}
	const checkInsertId = (id) => {
		if (newObjIds[id]) {
			throw new Meteor.Error(
				500,
				`savePreparedChangesIntoCache into collection "${
					(collection as any)._name
				}": Duplicate identifier "${id}"`
			)
		}
		newObjIds[id] = true
	}

	_.each(preparedChanges.changed || [], (oUpdate) => {
		checkInsertId(oUpdate._id)
		if (options.update) {
			options.update(oUpdate)
		} else {
			collection.replace(oUpdate)
		}
		if (options.afterUpdate) options.afterUpdate(oUpdate)
		change.updated++
	})

	_.each(preparedChanges.inserted || [], (oInsert) => {
		checkInsertId(oInsert._id)
		if (options.insert) {
			options.insert(oInsert)
		} else {
			collection.insert(oInsert)
		}
		if (options.afterInsert) options.afterInsert(oInsert)
		change.added++
	})

	_.each(preparedChanges.removed || [], (oRemove) => {
		if (options.remove) {
			options.remove(oRemove)
		} else {
			collection.remove(oRemove._id)
		}

		if (options.afterRemove) options.afterRemove(oRemove)
		change.removed++
	})
	if (options.unchanged) {
		_.each(preparedChanges.unchanged || [], (o) => {
			if (options.unchanged) options.unchanged(o)
		})
	}

	if (options.afterRemoveAll) {
		const objs = _.compact(preparedChanges.removed || [])
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	span?.end()
	return change
}
