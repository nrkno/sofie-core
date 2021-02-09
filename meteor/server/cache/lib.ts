import { Meteor } from 'meteor/meteor'
import { DBObj, compareObjs, PreparedChanges, Changes, ChangedIds } from '../../lib/lib'
import * as _ from 'underscore'
import { MongoQuery } from '../../lib/typings/meteor'
import { profiler } from '../api/profiler'
import { DbCacheReadCollection, DbCacheWriteCollection } from './CacheCollection'
import { DbCacheWriteObject } from './CacheObject'

export function isDbCacheReadCollection(o: any): o is DbCacheReadCollection<any, any> {
	return !!(o && typeof o === 'object' && o.fillWithDataFromDatabase)
}
export function isDbCacheWritable(o: any): o is DbCacheWriteCollection<any, any> | DbCacheWriteObject<any, any> {
	return !!(o && typeof o === 'object' && o.updateDatabaseWithData)
}
/** Caches data, allowing reads from cache, but not writes */
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
): ChangedIds<DBInterface['_id']> {
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
): ChangedIds<DBInterface['_id']> {
	const span = profiler.startSpan(`DBCache.savePreparedChangesIntoCache.${collection.name}`)

	let change: ChangedIds<DBInterface['_id']> = {
		added: [],
		updated: [],
		removed: [],
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
		change.updated.push(oUpdate._id)
	})

	_.each(preparedChanges.inserted || [], (oInsert) => {
		checkInsertId(oInsert._id)
		if (options.insert) {
			options.insert(oInsert)
		} else {
			collection.insert(oInsert)
		}
		if (options.afterInsert) options.afterInsert(oInsert)
		change.added.push(oInsert._id)
	})

	_.each(preparedChanges.removed || [], (oRemove) => {
		if (options.remove) {
			options.remove(oRemove)
		} else {
			collection.remove(oRemove._id)
		}

		if (options.afterRemove) options.afterRemove(oRemove)
		change.removed.push(oRemove._id)
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
