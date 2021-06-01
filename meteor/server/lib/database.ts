import { Meteor } from 'meteor/meteor'
import { BulkWriteOperation } from 'mongodb'
import _ from 'underscore'
import { AsyncTransformedCollection } from '../../lib/collections/lib'
import { DBObj, waitForPromise, normalizeArrayToMap, ProtectedString } from '../../lib/lib'
import {
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
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
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
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
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
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
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

	const pBulkWriteResult = collection.bulkWriteAsync(updates)

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
		const oldObj = objectsToRemove.get(o._id)

		if (oldObj) {
			const o2 = options.beforeDiff ? options.beforeDiff(o, oldObj) : o
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

/** @deprecated use the collection.findFetchAsync */
export async function asyncCollectionFindFetch<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface>,
	options?: FindOptions<DBInterface>
): Promise<Array<DocClass>> {
	return collection.findFetchAsync(selector, options)
}
/** @deprecated use the collection.findOneAsync */
export async function asyncCollectionFindOne<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	options?: FindOneOptions<DBInterface>
): Promise<DocClass | undefined> {
	return collection.findOneAsync(selector, options)
}
/** Insert document, and ignore if document already exists */
/** @deprecated use the collection.insertIgnoreAsync */
export async function asyncCollectionInsertIgnore<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(collection: AsyncTransformedCollection<DocClass, DBInterface>, doc: DBInterface): Promise<DBInterface['_id']> {
	return collection.insertIgnoreAsync(doc)
}
/** @deprecated use the collection.updateAsync */
export async function asyncCollectionUpdate<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	modifier: MongoModifier<DBInterface>,
	options?: UpdateOptions
): Promise<number> {
	return collection.updateAsync(selector, modifier, options)
}

/** @deprecated use the collection.upsertAsync */
export async function asyncCollectionUpsert<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id'],
	modifier: MongoModifier<DBInterface>,
	options?: UpsertOptions
): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }> {
	return collection.upsertAsync(selector, modifier, options)
}

/** @deprecated use the collection.removeAsync */
export async function asyncCollectionRemove<
	DocClass extends DBInterface,
	DBInterface extends { _id: ProtectedString<any> }
>(
	collection: AsyncTransformedCollection<DocClass, DBInterface>,
	selector: MongoQuery<DBInterface> | DBInterface['_id']
): Promise<number> {
	return collection.removeAsync(selector)
}
