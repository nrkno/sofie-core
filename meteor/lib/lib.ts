import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection, Selector } from './typings/meteor'
import { PeripheralDeviceAPI } from './api/peripheralDevice'
import { logger } from './logging'
import * as Timecode from 'smpte-timecode'
import { Settings } from './Settings'
import * as objectPath from 'object-path'
import { Mongo } from 'meteor/mongo'

/**
 * Convenience method to convert a Meteor.call() into a Promise
 * @param  {string} Method name
 * @return {Promise<any>}
 */
export function MeteorPromiseCall (callName: string, ...args: any[] ): Promise<any> {
	return new Promise((resolve, reject) => {
		Meteor.call(callName, ...args, (err, res) => {
			if (err) reject(err)
			else resolve(res)
		})
	})
}

export type Time = number

/**
 * Returns the current (synced) time
 * @return {Time}
 */
export function getCurrentTime (): Time {
	return Math.floor(Date.now() - systemTime.diff)
}
let systemTime = {
	diff: 0,
	stdDev: 9999
}
export {systemTime}

if (Meteor.isServer) {
	// handled in timesync
} else {
	// fetch time from server:
	let updateDiffTime = () => {
		let sentTime = Date.now()
		Meteor.call(PeripheralDeviceAPI.methods.getTimeDiff, (err, stat) => {
			let replyTime = Date.now()
			if (err) {
				logger.error(err)
			} else {
				logger.debug(stat)
				let diffTime = ((sentTime + replyTime) / 2) - stat.currentTime

				systemTime.diff = diffTime
				systemTime.stdDev = Math.abs(sentTime - replyTime) / 2
				logger.debug('time diff to server: ' + systemTime.diff + 'ms (stdDev: ' + (Math.floor(systemTime.stdDev * 10) / 10) + 'ms)')
				if (!stat.good) {
					Meteor.setTimeout(() => {
						updateDiffTime()
					}, 20 * 1000)
				} else if (!stat.good || systemTime.stdDev > 50) {
					Meteor.setTimeout(() => {
						updateDiffTime()
					}, 2000)
				}
			}
		})
	}

	Meteor.startup(() => {
		Meteor.setInterval(() => {
			updateDiffTime()
		}, 3600 * 1000)
		updateDiffTime()
		// Meteor.setTimeout(() => {
		// 	updateDiffTime()
		// }, 2000)
	})
}
export type Optional<T> = {
	[K in keyof T]?: T[K]
}

// type Test<T> = {
// 	[K in keyof T]: T[K]
// }

export interface DBObj {
	_id: string,
	[key: string]: any
}
interface SaveIntoDbOptions<DocClass, DBInterface> {
	beforeInsert?: (o: DBInterface) => DBInterface
	beforeUpdate?: (o: DBInterface, pre?: DocClass) => DBInterface
	beforeRemove?: (o: DocClass) => DBInterface
	beforeDiff?: (o: DBInterface, oldObj: DocClass) => DBInterface
	insert?: (o: DBInterface) => void
	update?: (id: string, o: DBInterface, ) => void
	remove?: (o: DBInterface ) => void
	afterInsert?: (o: DBInterface) => void
	afterUpdate?: (o: DBInterface) => void
	afterRemove?: (o: DBInterface) => void
}
/**
 * Saves an array of data into a collection
 * No matter if the data needs to be created, updated or removed
 * @param collection The collection to be updated
 * @param filter The filter defining the data subset to be affected in db
 * @param newData The new data
 */
export function saveIntoDb<DocClass extends DBInterface, DBInterface extends DBObj> (
	collection: TransformedCollection<DocClass, DBInterface>,
	filter: Selector<DBInterface>,
	newData: Array<DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
) {
	let change = {
		added: 0,
		updated: 0,
		removed: 0
	}
	let options: SaveIntoDbOptions<DocClass, DBInterface> = optionsOrg || {}

	let identifier = '_id'

	let oldObjs: Array<DocClass> = collection.find(filter).fetch()

	let newObjs2 = []

	let removeObjs: {[id: string]: DocClass} = {}
	_.each(oldObjs,function (o: DocClass) {

		if (removeObjs['' + o[identifier]]) {
			// duplicate id:
			collection.remove(o._id)
			change.removed++
		} else {
			removeObjs['' + o[identifier]] = o
		}

	})

	_.each(newData,function (o) {

		// if (_.has(o,'type')) {
		// 	o.type2 = o.type
		// 	delete o.type
		// }

		let oldObj = removeObjs['' + o[identifier]]
		if (oldObj) {

			let o2 = o
			if (options.beforeDiff) o2 = options.beforeDiff(o, oldObj)
			let diff = compareObjs(oldObj,o2)

			if (!diff) {
				let oUpdate = ( options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o)
				if (options.update) options.update(oldObj._id, oUpdate)
				else collection.update(oldObj._id,{$set: oUpdate})
				if (options.afterUpdate) options.afterUpdate(oUpdate)
				change.updated++
			}
		} else {
			if (!_.isNull(oldObj)) {
				let oInsert = ( options.beforeInsert ? options.beforeInsert(o) : o)
				if (options.insert) options.insert(oInsert)
				else collection.insert(oInsert)
				if (options.afterInsert) options.afterInsert(oInsert)
				change.added++
			}
		}
		delete removeObjs['' + o[identifier]]
	})
	_.each(removeObjs, function (obj: DocClass, key) {
		if (obj) {

			let oRemove = ( options.beforeRemove ? options.beforeRemove(obj) : obj)
			if (options.remove) options.remove(oRemove)
			else collection.remove(oRemove._id)
			if (options.afterRemove) options.afterRemove(oRemove)
			change.removed++

		}
	})
	return change
}
/**
 * Deep comparison of objects, returns true if equal
 * @param a
 * @param b
 * @param onlyKeysFromA If true, only uses the keys of (a) for comparison
 * @param omit Array of keys to omit in the comparison
 */
function compareObjs (a: any, b: any, onlyKeysFromA?: boolean, omit?: Array<string>): boolean {

	// let omit = ['_id','type','created','owner','OP','disabled']
	omit = omit || []

	let a0 = _.omit(a,omit)
	let b0 = _.omit(b,omit)

	let simpleCompare = (a: any, b: any, trace?: string) => {
		if (!trace) trace = ''
		let different: boolean | string = false

		if (_.isObject(a)) {
			if (_.isObject(b)) {

				let keys = (onlyKeysFromA ? _.keys(a) : _.union(_.keys(a), _.keys(b)))

				_.each(keys, (key) => {
					if (different === false) {
						different = simpleCompare(a[key], b[key], trace + '.' + key)
					}
				})

			} else different = trace + '>object'
		} else if (_.isArray(a)) {
			if (_.isArray(b) && a.length === b.length) {

				_.each(a, (val0, key) => {
					if (different === false) {
						different = simpleCompare(a[key], b[key], trace + '[' + key + ']')
					}
				})

			} else different = trace + '>array'
		} else {
			if (a !== b) different = trace + '(' + a + '!==' + b + ')'
		}

		return different
	}

	let diff = simpleCompare(a0,b0)

	return !diff
}
export function literal<T> (o: T) { return o }
export type Partial<T> = {
	[P in (keyof T)]?: T[P];
}
export function partial<T> (o: Partial<T>) {
	return o
}
export interface IDObj {
	_id: string
}
export function partialExceptId<T> (o: Partial<T> & IDObj) {
	return o
}
export function applyClassToDocument (docClass, document) {
	return new docClass(document)
}
/**
 * Iterates deeply through object or array
 * @param obj the object or array to iterate through
 * @param iteratee function to apply on every attribute
 */
export function iterateDeeply (obj: any, iteratee: (val: any, key?: string | number) => (any | iterateDeeplyEnum), key?: string | number) {
	let newValue = iteratee(obj, key)
	if (newValue === iterateDeeplyEnum.CONTINUE) {
		// Continue iterate deeper if possible
		if (_.isObject(obj)) { // object or array
			_.each(obj, (val, key) => {
				obj[key] = iterateDeeply(val, iteratee, key)
			})
		} else {
			// don't change anything
		}
		return obj
	} else {
		return newValue
	}
}
/**
 * Iterates deeply through object or array, using an asynchronous iteratee
 * @param obj the object or array to iterate through
 * @param iteratee function to apply on every attribute
 */
export async function iterateDeeplyAsync (obj: any, iteratee: (val: any, key?: string | number) => Promise<any | iterateDeeplyEnum>, key?: string | number) {
	let newValue = await iteratee(obj, key)
	if (newValue === iterateDeeplyEnum.CONTINUE) {
		// Continue iterate deeper if possible
		if (_.isObject(obj)) { // object or array
			await Promise.all(_.map(obj, async (val, key) => {
				obj[key] = await iterateDeeply(val, iteratee, key)
			}))
		} else {
			// don't change anything
		}
		return obj
	} else {
		return newValue
	}
}
export enum iterateDeeplyEnum {
	CONTINUE = '$continue'
}
export function formatDateAsTimecode (date: Date) {
	return Timecode(date, Settings['frameRate'], false).toString()
}
/**
 * @param duration time in milliseconds
 */
export function formatDurationAsTimecode (duration: Time) {
	return Timecode(duration * Settings['frameRate'] / 1000, Settings['frameRate'], false).toString()
}
/**
 * Deeply iterates through the object and removes propertys whose value equals null
 * @param obj
 */
export function removeNullyProperties<T> (obj: T): T {
	iterateDeeply(obj, (val, key) => {
		if (_.isArray(val)) {
			return iterateDeeplyEnum.CONTINUE
		} else if (_.isObject(val)) {
			_.each(_.keys(val), (k) => {
				if (_.isNull(val[k])) {
					delete val[k]
				}
			})
			return iterateDeeplyEnum.CONTINUE
		} else {
			return val
		}
	})
	return obj
}
export function objectPathGet (obj: any, path: string, defaultValue?: any) {
	let v = objectPath.get(obj, path)
	if (v === undefined && defaultValue !== undefined) return defaultValue
	return v
}
/**
 * Returns a string that can be used to compare objects for equality
 * @param objs
 */
export function stringifyObjects (objs: any): string {
	if (_.isArray(objs)) {
		return _.map(objs, (obj) => {
			return stringifyObjects(obj)
		}).join(',')
	} else if (_.isFunction(objs)) {
		return ''
	} else if (_.isObject(objs)) {
		let keys = _.sortBy(_.keys(objs), (k) => k)

		return _.map(keys, (key) => {
			return key + '=' + stringifyObjects(objs[key])
		}).join(',')
	} else {
		return objs + ''
	}
}
export const Collections: {[name: string]: Mongo.Collection<any>} = {}
export function registerCollection (name: string, collection: Mongo.Collection<any>) {
	Collections[name] = collection
}
export const getCollectionIndexes: (collection: Mongo.Collection<any>) => Array<any> = Meteor.wrapAsync(
	function getCollectionIndexes (collection: Mongo.Collection<any>, cb) {
		let raw = collection.rawCollection()
		raw.indexes(cb)
	}
)
export const getCollectionStats: (collection: Mongo.Collection<any>) => Array<any> = Meteor.wrapAsync(
	function getCollectionStats (collection: Mongo.Collection<any>, cb) {
		let raw = collection.rawCollection()
		raw.stats(cb)
	}
)
export function fetchBefore<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
	if (_.isNull(rank)) rank = Number.POSITIVE_INFINITY
	return collection.find(_.extend(selector, {
		_rank: {$lt: rank}
	}), {
		sort: {
			_rank: -1,
			_id: -1
		},
		limit: 1
	}).fetch()[0]
}
export function fetchAfter<T> (collection: Mongo.Collection<T>, selector: Mongo.Selector, rank: number | null): T {
	if (_.isNull(rank)) rank = Number.NEGATIVE_INFINITY
	return collection.find(_.extend(selector, {
		_rank: {$gt: rank}
	}), {
		sort: {
			_rank: 1,
			_id: 1
		},
		limit: 1
	}).fetch()[0]
}
export function getRank (beforeOrLast, after, i: number, count: number): number {
	let newRankMax
	let newRankMin

	if (after) {
		if (beforeOrLast) {
			newRankMin = beforeOrLast._rank
			newRankMax = after._rank
		} else {
			// First
			newRankMin = after._rank - 1
			newRankMax = after._rank
		}
	} else {
		if (beforeOrLast) {
			// Last
			newRankMin = beforeOrLast._rank
			newRankMax = beforeOrLast._rank + 1
		} else {
			// Empty list
			newRankMin = 0
			newRankMax = 1
		}
	}
	return newRankMin + ( (i + 1) / (count + 1) ) * (newRankMax - newRankMin)
}
export function normalizeArray<T> (array: Array<T>, indexKey: keyof T) {
	const normalizedObject: any = {}
	for (let i = 0; i < array.length; i++) {
		const key = array[i][indexKey]
		normalizedObject[key] = array[i]
	}
	return normalizedObject as { [key: string]: T }
}

export function rateLimit (name: string,f1: Function, f2: Function, t: number) {
	// if time t has passed since last call, run f1(), otherwise run f2()
	if (Math.random() < 0.05) Meteor.setTimeout(cleanUpRateLimit, 10000)

	if (rateLimitCache[name] && Math.abs(Date.now() - rateLimitCache[name]) < t ) {
		if (f2)	return f2()
		return null
	}

	rateLimitCache[name] = Date.now()
	if (f1)	return f1()

	return null
}
const rateLimitCache: {[name: string]: number} = {}
function cleanUpRateLimit () {
	const now = Date.now()
	const maxTime = 1000
	for (const name in rateLimitCache) {
		if (rateLimitCache[name] && Math.abs(now - rateLimitCache[name]) > maxTime ) {
			delete rateLimitCache[name]
		}
	}
}

export function rateLimitAndDoItLater (name: string, f1: Function, limit: number) {
	// if time *limit* has passed since last call, run f1(), otherwise run f1 later
	if (Math.random() < 0.05) Meteor.setTimeout(cleanUprateLimitAndDoItLater, 10000)

	const timeSinceLast = Date.now() - (rateLimitAndDoItLaterCache[name] || 0)

	if (timeSinceLast > limit) {
		// do it right away:
		rateLimitAndDoItLaterCache[name] = Date.now()
		f1()
		return true
	} else {
		// do it later
		rateLimitAndDoItLaterCache[name] += limit
		Meteor.setTimeout(f1,(Date.now() - rateLimitAndDoItLaterCache[name]))

		return false
	}
}
const rateLimitAndDoItLaterCache: {[name: string]: number} = {}
function cleanUprateLimitAndDoItLater () {
	const now = Date.now()
	const maxTime = 1
	for (const name in rateLimitAndDoItLaterCache) {
		if (rateLimitAndDoItLaterCache[name] && rateLimitAndDoItLaterCache[name] < (now - 100) ) {
			delete rateLimitAndDoItLaterCache[name]
		}
	}
}

export function rateLimitIgnore (name: string, f1: Function, limit: number) {
	// if time *limit* has passed since function was last run, run it right away.
	// Otherwise, set it to run in some time
	// If the function is set to run in the future, additional calls will be ignored.

	if (Math.random() < 0.05) Meteor.setTimeout(cleanUprateLimitIgnore, 10 * 1000)

	const timeSinceLast = Date.now() - (rateLimitIgnoreCache[name] || 0)

	if (timeSinceLast > limit) {
		// do it right away:

		rateLimitIgnoreCache[name] = Date.now()
		f1()
		return 1
	} else {
		// do it later:

		const lastTime = rateLimitIgnoreCache[name]
		const nextTime = lastTime + limit

		// is there a timeout set?
		if (!rateLimitIgnoreCache[name + '_timeout']) {

			rateLimitIgnoreCache[name + '_timeout'] = Meteor.setTimeout(() => {

				delete rateLimitIgnoreCache[name + '_timeout']

				f1()

				rateLimitIgnoreCache[name] = Date.now()

			},((nextTime - Date.now()) || 0) )
			return 0
		} else {
			// there is already a timeout on it's way, ignore this call then.
			return -1
		}
	}
}
const rateLimitIgnoreCache: {[name: string]: number} = {}
function cleanUprateLimitIgnore () {
	const now = Date.now()
	const maxTime = 1
	for (const name in rateLimitIgnoreCache) {
		if (rateLimitIgnoreCache[name] && rateLimitIgnoreCache[name] < (now - 100) ) {
			delete rateLimitIgnoreCache[name]
		}
	}
}

export function escapeHtml (text: string): string {
	let map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	}
	return text.replace(/[&<>"']/g, (m) => {
		return map[m]
	})
}
