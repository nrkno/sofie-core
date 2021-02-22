import { Meteor } from 'meteor/meteor'
import { DBObj, ChangedIds } from '../../lib/lib'
import * as _ from 'underscore'
import { MongoQuery } from '../../lib/typings/meteor'
import { profiler } from '../api/profiler'
import { DbCacheReadCollection, DbCacheWriteCollection } from './CacheCollection'
import { DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'

export function isDbCacheReadCollection(o: any): o is DbCacheReadCollection<any, any> {
	return !!(o && typeof o === 'object' && o.fillWithDataFromDatabase)
}
export function isDbCacheWritable(
	o: any
): o is DbCacheWriteCollection<any, any> | DbCacheWriteObject<any, any> | DbCacheWriteOptionalObject<any, any> {
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
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
): ChangedIds<DBInterface['_id']> {
	const span = profiler.startSpan(`DBCache.saveIntoCache.${collection.name}`)

	const changes: ChangedIds<DBInterface['_id']> = {
		added: [],
		updated: [],
		removed: [],
		unchanged: [],
	}

	const options: SaveIntoDbOptions<DocClass, DBInterface> = optionsOrg || {}

	const newObjIds = new Set<DBInterface['_id']>()
	_.each(newData, (o) => {
		if (newObjIds.has(o._id)) {
			throw new Meteor.Error(
				500,
				`saveIntoCache into collection "${collection.name}": Duplicate identifier _id: "${o._id}"`
			)
		}
		newObjIds.add(o._id)
	})

	const oldObjs: Array<DocClass> = collection.findFetch(filter)

	const objectsToRemove = new Map<DBInterface['_id'], DocClass>()
	for (const o of oldObjs) {
		objectsToRemove.set(o._id, o)
	}

	for (const o of newData) {
		const oldObj = objectsToRemove.get(o._id)

		if (oldObj) {
			const o2 = options.beforeDiff ? options.beforeDiff(o, oldObj) : o
			const eql = _.isEqual(oldObj, o2)

			if (!eql) {
				const oUpdate = options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o
				if (options.update) {
					options.update(oUpdate)
				} else {
					collection.replace(oUpdate)
				}
				if (options.afterUpdate) options.afterUpdate(oUpdate)
				changes.updated.push(oUpdate._id)
			} else {
				if (options.unchanged) options.unchanged(o)
				changes.unchanged.push(oldObj._id)
			}
		} else {
			if (!_.isNull(oldObj)) {
				const oInsert = options.beforeInsert ? options.beforeInsert(o) : o
				if (options.insert) {
					options.insert(oInsert)
				} else {
					collection.insert(oInsert)
				}
				if (options.afterInsert) options.afterInsert(oInsert)
				changes.added.push(oInsert._id)
			}
		}
		objectsToRemove.delete(o._id)
	}
	for (const obj of objectsToRemove.values()) {
		if (obj) {
			const oRemove = options.beforeRemove ? options.beforeRemove(obj) : obj

			if (options.remove) {
				options.remove(oRemove)
			} else {
				collection.remove(oRemove._id)
			}

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
