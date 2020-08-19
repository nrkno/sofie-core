import { Meteor } from 'meteor/meteor'
import {
	ProtectedString,
	mongoWhere,
	isProtectedString,
	unprotectString,
	getRandomId,
	protectString,
	clone,
	asyncCollectionRemove,
	asyncCollectionInsert,
	asyncCollectionUpdate,
	asyncCollectionFindFetch,
	mongoModify,
	mongoFindOptions,
	DBObj,
	compareObjs,
	waitForPromiseAll,
	waitForPromise,
	asyncCollectionUpsert,
} from '../lib/lib'
import * as _ from 'underscore'
import { TransformedCollection, MongoModifier, FindOptions, MongoQuery } from '../lib/typings/meteor'

export function isDbCacheCollection(o: any): o is DbCacheCollection<any, any> {
	return !!(o && typeof o === 'object' && o.updateDatabaseWithData)
}
export class DbCacheCollection<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }> {
	documents: { [_id: string]: DbCacheCollectionDocument<Class> } = {}

	private _initialized: boolean = false
	private _initializer?: MongoQuery<DBInterface> | (() => Promise<void>) = undefined
	private _initializing: Promise<any> | undefined

	constructor(private _collection: TransformedCollection<Class, DBInterface>) {
		//
	}
	get name(): string | undefined {
		return this._collection['name']
	}

	prepareInit(initializer: MongoQuery<DBInterface> | (() => Promise<void>), initializeImmediately: boolean) {
		this._initializer = initializer
		if (initializeImmediately) {
			this._initialize()
		}
	}
	extendWithData(cacheCollection: DbCacheCollection<Class, DBInterface>) {
		this._initialized = cacheCollection._initialized
		this._initializer = cacheCollection._initializer
		_.each(cacheCollection.documents, (doc, key) => {
			if (!this.documents[key]) this.documents[key] = doc
		})
	}

	private _initialize() {
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
		return mongoFindOptions(results, options)
	}
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		options?: FindOptions<DBInterface>
	): Class | undefined {
		this._initialize()

		return this.findFetch(selector, options)[0]
	}
	insert(doc: DBInterface): DBInterface['_id'] {
		this._initialize()

		const existing = doc._id && this.documents[unprotectString(doc._id)]
		if (existing && !existing.removed) {
			throw new Meteor.Error(
				500,
				`Error in cache insert: _id "${doc._id}" already exists in collection "${this.name}"`
			)
		}
		if (!doc._id) doc._id = getRandomId()
		this.documents[unprotectString(doc._id)] = {
			inserted: true,
			document: this._transform(clone(doc)), // Unlinke a normal collection, this class stores the transformed objects
		}
		return doc._id
	}
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>): number {
		this._initialize()

		const idsToRemove = this.findFetch(selector).map((doc) => unprotectString(doc._id))
		_.each(idsToRemove, (id) => {
			this.documents[id].removed = true
			delete this.documents[id].document
		})
		return idsToRemove.length
	}
	update(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | SelectorFunction<DBInterface>,
		modifier: ((doc: DBInterface) => DBInterface) | MongoModifier<DBInterface>
	): number {
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

			if (!_.isEqual(doc, newDoc)) {
				newDoc = this._transform(newDoc)

				_.each(_.uniq([..._.keys(newDoc), ..._.keys(doc)]), (key) => {
					doc[key] = newDoc[key]
				})
				this.documents[_id].updated = true
			}
			count++
		})
		return count
	}

	upsert(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		doc: DBInterface
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	} {
		this._initialize()

		if (isProtectedString(selector)) {
			selector = { _id: selector } as any
		}

		const updatedCount = this.update(selector, doc)
		if (updatedCount > 0) {
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

			return { numberAffected: 1, insertedId: this.insert(doc) }
		}
	}

	async fillWithDataFromDatabase(selector: MongoQuery<DBInterface>): Promise<number> {
		const docs = await asyncCollectionFindFetch(this._collection, selector)

		this._innerfillWithDataFromArray(docs)
		return docs.length
	}
	fillWithDataFromArray(documents: DBInterface[]) {
		return this._innerfillWithDataFromArray(documents.map((doc) => this._transform(doc)))
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
	async updateDatabaseWithData() {
		const changes: {
			insert: number
			update: number
			remove: number
		} = {
			insert: 0,
			update: 0,
			remove: 0,
		}
		const ps: Promise<any>[] = []
		const removedDocs: ProtectedString<any>[] = []
		_.each(this.documents, (doc, id) => {
			const _id = protectString(id)
			if (doc.removed) {
				ps.push(asyncCollectionRemove(this._collection, _id))
				changes.remove++
				removedDocs.push(_id)
			} else if (doc.inserted) {
				ps.push(asyncCollectionUpsert(this._collection, doc.document._id, doc.document))
				changes.insert++
			} else if (doc.updated) {
				ps.push(asyncCollectionUpdate(this._collection, _id, doc.document))
				changes.update++
			}
			delete doc.inserted
			delete doc.updated
			// Note: we don't delete doc.removed, because that breaks this._collection[x].document
		})
		_.each(removedDocs, (_id) => {
			delete this._collection[unprotectString(_id)]
		})
		await Promise.all(ps)

		return changes
	}
	private _transform(doc: DBInterface): Class {
		// @ts-ignore hack: using internal function in collection
		const transform = this._collection._transform
		if (transform) {
			return transform(doc)
		} else return doc as Class
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
	update?: (id: ProtectedString<any>, o: DBInterface) => void
	remove?: (o: DBInterface) => void
	unchanged?: (o: DBInterface) => void
	afterInsert?: (o: DBInterface) => void
	afterUpdate?: (o: DBInterface) => void
	afterRemove?: (o: DBInterface) => void
	afterRemoveAll?: (o: Array<DBInterface>) => void
}
interface Changes {
	added: number
	updated: number
	removed: number
}
export function saveIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: DbCacheCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	options?: SaveIntoDbOptions<DocClass, DBInterface>
): Changes {
	const preparedChanges = prepareSaveIntoCache(collection, filter, newData, options)

	return savePreparedChangesIntoCache(preparedChanges, collection, options)
}
export interface PreparedChanges<T> {
	inserted: T[]
	changed: { doc: T; oldId: ProtectedString<any> }[]
	removed: T[]
	unchanged: T[]
}
export function prepareSaveIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: DbCacheCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
): PreparedChanges<DBInterface> {
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
				preparedChanges.changed.push({ doc: oUpdate, oldId: oldObj._id })
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
	return preparedChanges
}
export function savePreparedChangesIntoCache<DocClass extends DBInterface, DBInterface extends DBObj>(
	preparedChanges: PreparedChanges<DBInterface>,
	collection: DbCacheCollection<DocClass, DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
) {
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
		checkInsertId(oUpdate.doc._id)
		if (options.update) {
			options.update(oUpdate.oldId, oUpdate.doc)
		} else {
			collection.update(oUpdate.oldId, oUpdate.doc)
		}
		if (options.afterUpdate) options.afterUpdate(oUpdate.doc)
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

	return change
}
