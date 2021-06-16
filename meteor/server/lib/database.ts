import { Meteor } from 'meteor/meteor'
import { BulkWriteOperation, BulkWriteOpResultObject } from 'mongodb'
import _ from 'underscore'
import {
	DBObj,
	waitForPromise,
	normalizeArrayToMap,
	ProtectedString,
	makePromise,
	sleep,
	deleteAllUndefinedProperties,
} from '../../lib/lib'
import {
	TransformedCollection,
	MongoQuery,
	FindOptions,
	MongoModifier,
	UpdateOptions,
	UpsertOptions,
	FindOneOptions,
} from '../../lib/typings/meteor'
import { profiler } from '../api/profiler'

export interface Changes {
	added: number
	updated: number
	removed: number
}
export interface ChangedIds<T extends ProtectedString<any>> {
	added: T[]
	updated: T[]
	removed: T[]
	unchanged: T[]
}

export function sumChanges(...changes: (Changes | ChangedIds<any> | null)[]): Changes {
	let change: Changes = {
		added: 0,
		updated: 0,
		removed: 0,
	}
	_.each(changes, (c) => {
		if (c) {
			change.added += Array.isArray(c.added) ? c.added.length : c.added
			change.updated += Array.isArray(c.updated) ? c.updated.length : c.updated
			change.removed += Array.isArray(c.removed) ? c.removed.length : c.removed
		}
	})
	return change
}
export function anythingChanged(changes: Changes): boolean {
	return !!(changes.added || changes.removed || changes.updated)
}

/**
 * Saves an array of data into a collection
 * No matter if the data needs to be created, updated or removed
 * @param collection The collection to be updated
 * @param filter The filter defining the data subset to be affected in db
 * @param newData The new data
 */
export function saveIntoDb<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: TransformedCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	options?: SaveIntoDbHooks<DocClass, DBInterface>
): Changes {
	const preparedChanges = prepareSaveIntoDb(collection, filter, newData, options)

	const changes = savePreparedChanges(preparedChanges, collection, options ?? {})

	return waitForPromise(changes)
}

export interface PreparedChanges<T> {
	inserted: T[]
	changed: T[]
	removed: T[]
	unchanged: T[]
}

function prepareSaveIntoDb<DocClass extends DBInterface, DBInterface extends DBObj>(
	collection: TransformedCollection<DocClass, DBInterface>,
	filter: MongoQuery<DBInterface>,
	newData: Array<DBInterface>,
	optionsOrg?: SaveIntoDbHooks<DocClass, DBInterface>
): PreparedChanges<DBInterface> {
	const preparedChanges: PreparedChanges<DBInterface> = {
		inserted: [],
		changed: [],
		removed: [],
		unchanged: [],
	}

	saveIntoBase((collection as any)._name, collection.find(filter).fetch(), newData, {
		...optionsOrg,
		insert: (doc) => preparedChanges.inserted.push(doc),
		update: (doc) => preparedChanges.changed.push(doc),
		remove: (doc) => preparedChanges.removed.push(doc),
		unchanged: (doc) => preparedChanges.unchanged.push(doc),
		// supress hooks that are for the save phase
		afterInsert: undefined,
		afterRemove: undefined,
		afterRemoveAll: undefined,
		afterUpdate: undefined,
	})

	return preparedChanges
}
async function savePreparedChanges<DocClass extends DBInterface, DBInterface extends DBObj>(
	preparedChanges: PreparedChanges<DBInterface>,
	collection: TransformedCollection<DocClass, DBInterface>,
	options: SaveIntoDbHooks<DocClass, DBInterface>
): Promise<Changes> {
	let change: Changes = {
		added: 0,
		updated: 0,
		removed: 0,
	}
	const newObjIds: { [identifier: string]: true } = {}
	const checkInsertId = (id) => {
		if (newObjIds[id]) {
			throw new Meteor.Error(
				500,
				`savePreparedChanges into collection "${(collection as any)._name}": Duplicate identifier "${id}"`
			)
		}
		newObjIds[id] = true
	}

	const updates: BulkWriteOperation<DBInterface>[] = []
	const removedDocs: DocClass['_id'][] = []

	_.each(preparedChanges.changed || [], (oUpdate) => {
		checkInsertId(oUpdate._id)
		updates.push({
			replaceOne: {
				filter: {
					_id: oUpdate._id as any,
				},
				replacement: oUpdate,
			},
		})
		change.updated++
		if (options.afterUpdate) options.afterUpdate(oUpdate)
	})

	_.each(preparedChanges.inserted || [], (oInsert) => {
		checkInsertId(oInsert._id)
		updates.push({
			replaceOne: {
				filter: {
					_id: oInsert._id as any,
				},
				replacement: oInsert,
				upsert: true,
			},
		})
		change.added++
		if (options.afterInsert) options.afterInsert(oInsert)
	})

	_.each(preparedChanges.removed || [], (oRemove) => {
		removedDocs.push(oRemove._id)
		change.removed++
		if (options.afterRemove) options.afterRemove(oRemove)
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

	const pBulkWriteResult = updates.length > 0 ? asyncCollectionBulkWrite(collection, updates) : null

	await pBulkWriteResult

	if (options.afterRemoveAll) {
		const objs = _.compact(preparedChanges.removed || [])
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	return change
}

export interface SaveIntoDbHooks<DocClass, DBInterface> {
	beforeInsert?: (o: DBInterface) => DBInterface
	beforeUpdate?: (o: DBInterface, pre?: DocClass) => DBInterface
	beforeRemove?: (o: DocClass) => DBInterface
	beforeDiff?: (o: DBInterface, oldObj: DocClass) => DBInterface
	afterInsert?: (o: DBInterface) => void
	afterUpdate?: (o: DBInterface) => void
	afterRemove?: (o: DBInterface) => void
	afterRemoveAll?: (o: Array<DBInterface>) => void
}

interface SaveIntoDbHandlers<DBInterface> {
	insert: (o: DBInterface) => void
	update: (o: DBInterface) => void
	remove: (o: DBInterface) => void
	unchanged?: (o: DBInterface) => void
}
export function saveIntoBase<DocClass extends DBInterface, DBInterface extends DBObj>(
	collectionName: string,
	oldDocs: DocClass[],
	newData: Array<DBInterface>,
	options: SaveIntoDbHooks<DocClass, DBInterface> & SaveIntoDbHandlers<DBInterface>
): ChangedIds<DBInterface['_id']> {
	const span = profiler.startSpan(`DBCache.saveIntoBase.${collectionName}`)

	const changes: ChangedIds<DBInterface['_id']> = {
		added: [],
		updated: [],
		removed: [],
		unchanged: [],
	}

	const newObjIds = new Set<DBInterface['_id']>()
	_.each(newData, (o) => {
		if (newObjIds.has(o._id)) {
			throw new Meteor.Error(
				500,
				`saveIntoBase into collection "${collectionName}": Duplicate identifier _id: "${o._id}"`
			)
		}
		newObjIds.add(o._id)
	})

	const objectsToRemove = normalizeArrayToMap(oldDocs, '_id')

	for (const o of newData) {
		// const span2 = profiler.startSpan(`DBCache.saveIntoBase.${collectionName}.do.${o._id}`)
		const oldObj = objectsToRemove.get(o._id)

		if (oldObj) {
			const o2 = options.beforeDiff ? options.beforeDiff(o, oldObj) : o
			deleteAllUndefinedProperties(o2)
			const eql = _.isEqual(oldObj, o2)

			if (!eql) {
				const oUpdate = options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o
				options.update(oUpdate)
				if (options.afterUpdate) options.afterUpdate(oUpdate)
				changes.updated.push(oUpdate._id)
			} else {
				if (options.unchanged) options.unchanged(o)
				changes.unchanged.push(oldObj._id)
			}
		} else {
			const oInsert = options.beforeInsert ? options.beforeInsert(o) : o
			options.insert(oInsert)
			if (options.afterInsert) options.afterInsert(oInsert)
			changes.added.push(oInsert._id)
		}
		objectsToRemove.delete(o._id)

		// span2?.end()
	}
	for (const obj of objectsToRemove.values()) {
		if (obj) {
			const oRemove = options.beforeRemove ? options.beforeRemove(obj) : obj

			options.remove(oRemove)

			if (options.afterRemove) options.afterRemove(oRemove)
			changes.removed.push(oRemove._id)
		}
	}

	if (options.afterRemoveAll) {
		const objs = _.compact(Array.from(objectsToRemove.values()))
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	span?.addLabels(changes as any)
	span?.end()
	return changes
}

export async function asyncCollectionFindFetch<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | string,
	options?: FindOptions<DBInterface>
): Promise<Array<DocClass>> {
	// Make the collection fethcing in another Fiber:
	const p = makePromise(() => {
		return collection.find(selector as any, options).fetch()
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}
export async function asyncCollectionFindOne<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	options?: FindOneOptions<DBInterface>
): Promise<DocClass | undefined> {
	const arr = await asyncCollectionFindFetch(collection, selector, { ...options, limit: 1 })
	return arr[0]
}
export async function asyncCollectionInsert<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(collection: TransformedCollection<DocClass, DBInterface>, doc: DBInterface): Promise<DBInterface['_id']> {
	const p = makePromise(() => {
		return collection.insert(doc)
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}
export function asyncCollectionInsertMany<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(collection: TransformedCollection<DocClass, DBInterface>, docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
	return Promise.all(_.map(docs, (doc) => asyncCollectionInsert(collection, doc)))
}
/** Insert document, and ignore if document already exists */
export async function asyncCollectionInsertIgnore<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(collection: TransformedCollection<DocClass, DBInterface>, doc: DBInterface): Promise<DBInterface['_id']> {
	const p = makePromise(() => {
		return collection.insert(doc)
	}).catch((err) => {
		if (err.toString().match(/duplicate key/i)) {
			// @ts-ignore id duplicate, doc._id must exist
			return doc._id
		} else {
			throw err
		}
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}
export async function asyncCollectionUpdate<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	modifier: MongoModifier<DBInterface>,
	options?: UpdateOptions
): Promise<number> {
	const p = makePromise(() => {
		return collection.update(selector, modifier, options)
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}

export async function asyncCollectionUpsert<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	modifier: MongoModifier<DBInterface>,
	options?: UpsertOptions
): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }> {
	const p = makePromise(() => {
		return collection.upsert(selector, modifier, options)
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}

export async function asyncCollectionRemove<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id']
): Promise<number> {
	const p = makePromise(() => {
		return collection.remove(selector)
	})
	// Pause the current Fiber briefly, in order to allow for the other Fiber to start executing:
	await sleep(0)
	return p
}

export async function asyncCollectionBulkWrite<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: TransformedCollection<DocClass, DBInterface>,
	ops: Array<BulkWriteOperation<DBInterface>>
): Promise<BulkWriteOpResultObject> {
	if (ops.length > 0) {
		const rawCollection = collection.rawCollection()
		const bulkWriteResult = await rawCollection.bulkWrite(ops, {
			ordered: false,
		})

		if (
			bulkWriteResult &&
			_.isArray(bulkWriteResult.result?.writeErrors) &&
			bulkWriteResult.result.writeErrors.length
		) {
			throw new Meteor.Error(
				500,
				`Errors in rawCollection.bulkWrite: ${bulkWriteResult.result.writeErrors.join(',')}`
			)
		}
		return bulkWriteResult
	} else {
		return {}
	}
}
