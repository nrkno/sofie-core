import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection, MongoSelector, MongoModifier, UpdateOptions, UpsertOptions, FindOptions } from './typings/meteor'
import { logger } from './logging'
import { Timecode } from 'timecode'
import { Settings } from './Settings'
import * as objectPath from 'object-path'
import { iterateDeeply, iterateDeeplyEnum } from 'tv-automation-sofie-blueprints-integration'
import * as crypto from 'crypto'
const cloneOrg = require('fast-clone')

export function clone<T> (o: T): T {
	// Use this instead of fast-clone directly, as this retains the type
	return cloneOrg(o)
}

export function getHash (str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[\+\/\=]/g, '_') // remove +/= from strings, because they cause troubles
}

/**
 * Convenience method to convert a Meteor.call() into a Promise
 * @param  {string} Method name
 * @return {Promise<any>}
 */
export function MeteorPromiseCall (callName: string, ...args: any[]): Promise<any> {
	return new Promise((resolve, reject) => {
		Meteor.call(callName, ...args, (err, res) => {
			if (err) reject(err)
			else resolve(res)
		})
	})
}

export type Time = number

const systemTime = {
	diff: 0,
	stdDev: 9999
}
/**
 * Returns the current (synced) time
 * @return {Time}
 */
export function getCurrentTime (): Time {
	return Math.floor(Date.now() - systemTime.diff)
}
export { systemTime }

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
	update?: (id: string, o: DBInterface,) => void
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
/**
 * Saves an array of data into a collection
 * No matter if the data needs to be created, updated or removed
 * @param collection The collection to be updated
 * @param filter The filter defining the data subset to be affected in db
 * @param newData The new data
 */
export function saveIntoDb<DocClass extends DBInterface, DBInterface extends DBObj> (
	collection: TransformedCollection<DocClass, DBInterface>,
	filter: MongoSelector<DBInterface>,
	newData: Array<DBInterface>,
	optionsOrg?: SaveIntoDbOptions<DocClass, DBInterface>
): Changes {
	let change: Changes = {
		added: 0,
		updated: 0,
		removed: 0
	}
	const options: SaveIntoDbOptions<DocClass, DBInterface> = optionsOrg || {}

	const identifier = '_id'

	const pOldObjs = asyncCollectionFindFetch(collection, filter)

	const newObjIds: {[identifier: string]: true} = {}
	_.each(newData, (o) => {
		if (newObjIds[o[identifier]]) {
			throw new Meteor.Error(500, `saveIntoDb into collection "${collection.rawCollection.name}": Duplicate identifier ${identifier}: "${o[identifier]}"`)
		}
		newObjIds[o[identifier]] = true
	})

	const oldObjs: Array<DocClass> = waitForPromise(pOldObjs)

	const ps: Array<Promise<any>> = []

	const removeObjs: {[id: string]: DocClass} = {}
	_.each(oldObjs,function (o: DocClass) {

		if (removeObjs['' + o[identifier]]) {
			// duplicate id:
			// collection.remove(o._id)
			ps.push(asyncCollectionRemove(collection, o._id))
			change.removed++
		} else {
			removeObjs['' + o[identifier]] = o
		}
	})

	_.each(newData,function (o) {

		const oldObj = removeObjs['' + o[identifier]]
		if (oldObj) {

			const o2 = (options.beforeDiff ? options.beforeDiff(o, oldObj) : o)
			const eql = compareObjs(oldObj, o2)

			if (!eql) {
				let p: Promise<any> | undefined
				let oUpdate = (options.beforeUpdate ? options.beforeUpdate(o, oldObj) : o)
				if (options.update) {
					options.update(oldObj._id, oUpdate)
				} else {
					p = asyncCollectionUpdate(collection, oldObj._id, oUpdate)
				}
				if (options.afterUpdate) {
					p = Promise.resolve(p)
					.then(() => {
						if (options.afterUpdate) options.afterUpdate(oUpdate)
					})
				}

				if (p) ps.push(p)
				change.updated++
			} else {
				if (options.unchanged) options.unchanged(oldObj)
			}
		} else {
			if (!_.isNull(oldObj)) {
				let p: Promise<any> | undefined
				let oInsert = (options.beforeInsert ? options.beforeInsert(o) : o)
				if (options.insert) {
					options.insert(oInsert)
				} else {
					p = asyncCollectionInsert(collection, oInsert)
				}
				if (options.afterInsert) {
					p = Promise.resolve(p)
					.then(() => {
						if (options.afterInsert) options.afterInsert(oInsert)
					})
				}
				if (p) ps.push(p)
				change.added++
			}
		}
		delete removeObjs['' + o[identifier]]
	})
	_.each(removeObjs, function (obj: DocClass, key) {
		if (obj) {
			let p: Promise<any> | undefined
			let oRemove: DBInterface = (options.beforeRemove ? options.beforeRemove(obj) : obj)
			if (options.remove) {
				options.remove(oRemove)
			} else {
				p = asyncCollectionRemove(collection, oRemove._id)
			}

			if (options.afterRemove) {
				p = Promise.resolve(p)
				.then(() => {
					// console.log('+++ lib/lib.ts +++', Fiber.current)
					if (options.afterRemove) options.afterRemove(oRemove)
				})
			}
			if (p) ps.push(p)
			change.removed++

		}
	})
	waitForPromiseAll(ps)

	if (options.afterRemoveAll) {
		const objs = _.compact(_.values(removeObjs))
		if (objs.length > 0) {
			options.afterRemoveAll(objs)
		}
	}

	return change
}
export function sumChanges (...changes: (Changes | null)[]): Changes {
	let change: Changes = {
		added: 0,
		updated: 0,
		removed: 0
	}
	_.each(changes, (c) => {
		if (c) {
			change.added += c.added
			change.updated += c.updated
			change.removed += c.removed
		}
	})
	return change
}
export function anythingChanged (changes: Changes): boolean {
	return !!(changes.added || changes.removed || changes.updated)
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
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
export interface IDObj {
	_id: string
}
export function partialExceptId<T> (o: Partial<T> & IDObj) {
	return o
}
export interface ObjId {
	_id: string
}
export type OmitId<T> = Omit<T & ObjId, '_id'>

export function omit<T, P extends keyof T> (obj: T, ...props: P[]): Omit<T, P> {
	return _.omit(obj, ...(props as string[]))
}

export type ReturnType<T extends Function> = T extends (...args: any[]) => infer R ? R : never

export function applyClassToDocument (docClass, document) {
	return new docClass(document)
}
export function formatDateAsTimecode (date: Date) {
	const tc = Timecode.init({ framerate: Settings.frameRate + '', timecode: date, drop_frame: !Number.isInteger(Settings.frameRate) })
	return tc.toString()
}
/**
 * @param duration time in milliseconds
 */
export function formatDurationAsTimecode (duration: Time) {
	const tc = Timecode.init({ framerate: Settings.frameRate + '', timecode: duration * Settings.frameRate / 1000, drop_frame: !Number.isInteger(Settings.frameRate) })
	return tc.toString()
}
/**
 * Formats the time as human-readable time "YYYY-MM-DD hh:ii:ss"
 * @param time
 */
export function formatDateTime (time: Time) {
	let d = new Date(time)

	let yyyy: any = d.getFullYear()
	let mm: any = d.getMonth() + 1
	let dd: any = d.getDate()

	let hh: any = d.getHours()
	let ii: any = d.getMinutes()
	let ss: any = d.getSeconds()

	if (mm < 10) mm = '0' + mm
	if (hh < 10) hh = '0' + hh
	if (ii < 10) ii = '0' + ii
	if (ss < 10) ss = '0' + ss

	return `${yyyy}-${mm}-${dd} ${hh}:${ii}:${ss}`
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
export function objectPathSet (obj: any, path: string, value: any) {
	objectPath.set(obj, path, value)
	return obj
}
/**
 * Returns a string that can be used to compare objects for equality
 * @param objs
 */
export function stringifyObjects (objs: any): string {
	if (_.isArray(objs)) {
		return _.map(objs, (obj) => {
			if (obj !== undefined) {
				return stringifyObjects(obj)
			}
		}).join(',')
	} else if (_.isFunction(objs)) {
		return ''
	} else if (_.isObject(objs)) {
		let keys = _.sortBy(_.keys(objs), (k) => k)

		return _.compact(_.map(keys, (key) => {
			if (objs[key] !== undefined) {
				return key + '=' + stringifyObjects(objs[key])
			} else {
				return null
			}
		})).join(',')
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
export function fetchBefore<T> (collection: Mongo.Collection<T>, selector: MongoSelector<T>, rank: number | null): T {
	if (_.isNull(rank)) rank = Number.POSITIVE_INFINITY
	return collection.find(_.extend(selector, {
		_rank: { $lt: rank }
	}), {
		sort: {
			_rank: -1,
			_id: -1
		},
		limit: 1
	}).fetch()[0]
}
export function fetchAfter<T> (collection: Mongo.Collection<T> | Array<T>, selector: MongoSelector<T>, rank: number | null): T | undefined {
	if (_.isNull(rank)) rank = Number.NEGATIVE_INFINITY

	selector = _.extend({}, selector, {
		_rank: { $gt: rank }
	})

	if (_.isArray(collection)) {
		return _.find(collection, (o) => mongoWhere(o, selector))
	} else {
		return collection.find(selector, {
			sort: {
				_rank: 1,
				_id: 1
			},
			limit: 1
		}).fetch()[0]
	}
}
export function getRank<T extends {_rank: number}> (
	beforeOrLast: T | null | undefined,
	after: T | null | undefined,
	i: number,
	count: number
): number {
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
	return newRankMin + ((i + 1) / (count + 1)) * (newRankMax - newRankMin)
}
export function normalizeArray<T> (array: Array<T>, indexKey: keyof T): {[indexKey: string]: T} {
	const normalizedObject: any = {}
	for (let i = 0; i < array.length; i++) {
		const key = array[i][indexKey]
		normalizedObject[key] = array[i]
	}
	return normalizedObject as { [key: string]: T }
}

const rateLimitCache: {[name: string]: number} = {}
export function rateLimit (name: string,f1: Function, f2: Function, t: number) {
	// if time t has passed since last call, run f1(), otherwise run f2()
	if (Math.random() < 0.05) Meteor.setTimeout(cleanUpRateLimit, 10000)

	if (rateLimitCache[name] && Math.abs(Date.now() - rateLimitCache[name]) < t) {
		if (f2)	return f2()
		return null
	}

	rateLimitCache[name] = Date.now()
	if (f1)	return f1()

	return null
}
function cleanUpRateLimit () {
	const now = Date.now()
	const maxTime = 1000
	for (const name in rateLimitCache) {
		if (rateLimitCache[name] && Math.abs(now - rateLimitCache[name]) > maxTime) {
			delete rateLimitCache[name]
		}
	}
}

const rateLimitAndDoItLaterCache: {[name: string]: number} = {}
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
function cleanUprateLimitAndDoItLater () {
	const now = Date.now()
	for (const name in rateLimitAndDoItLaterCache) {
		if (rateLimitAndDoItLaterCache[name] && rateLimitAndDoItLaterCache[name] < (now - 100)) {
			delete rateLimitAndDoItLaterCache[name]
		}
	}
}

const rateLimitIgnoreCache: {[name: string]: number} = {}
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

			},((nextTime - Date.now()) || 0))
			return 0
		} else {
			// there is already a timeout on it's way, ignore this call then.
			return -1
		}
	}
}
function cleanUprateLimitIgnore () {
	const now = Date.now()
	for (const name in rateLimitIgnoreCache) {
		if (rateLimitIgnoreCache[name] && rateLimitIgnoreCache[name] < (now - 100)) {
			delete rateLimitIgnoreCache[name]
		}
	}
}
const cacheResultCache: {
	[name: string]: {
		ttl: number,
		value: any
	}
} = {}
/** Cache the result of function for a limited time */
export function cacheResult<T> (name: string, fcn: () => T, limitTime: number = 1000) {

	if (Math.random() < 0.01) {
		Meteor.setTimeout(cleanCacheResult, 10000)
	}
	const cache = cacheResultCache[name]
	if (!cache || cache.ttl < Date.now()) {
		const value = fcn()
		cacheResultCache[name] = {
			ttl: Date.now() + limitTime,
			value: value
		}
		return value
	} else {
		return cache.value
	}
}
function cleanCacheResult () {
	_.each(cacheResultCache, (cache, name) => {
		if (cache.ttl < Date.now()) delete cacheResultCache[name]
	})
}

export function escapeHtml (text: string): string {
	// Escape strings, so they are XML-compatible:

	let map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	}
	let nbsp = String.fromCharCode(160) // non-breaking space (160)
	map[nbsp] = ' ' // regular space

	const textLength = text.length
	let outText = ''
	for (let i = 0; i < textLength; i++) {
		let c = text[i]
		if (map[c]) {
			outText += map[c]
		} else {
			outText += c
		}
	}
	return outText
}
const ticCache = {}
export function tic (name: string = 'default') {
	ticCache[name] = Date.now()
}
export function toc (name: string = 'default', logStr?: string | Promise<any>[]) {

	if (_.isArray(logStr)) {
		_.each(logStr, (promise, i) => {
			promise.then((result) => {
				toc(name, 'Promise ' + i)
				return result
			})
			.catch(e => {
				throw e
			})
		})
	} else {
		let t: number = Date.now() - ticCache[name]
		if (logStr) logger.info('toc: ' + name + ': ' + logStr + ': ' + t)
		return t
	}
}

export function asyncCollectionFindFetch<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoSelector<DBInterface> | string,
	options?: FindOptions
): Promise<Array<DocClass>> {
	return new Promise((resolve, reject) => {
		let results = collection.find(selector, options).fetch()
		resolve(results)
	})
}
export function asyncCollectionFindOne<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoSelector<DBInterface> | string
): Promise<DocClass> {
	return asyncCollectionFindFetch(collection, selector)
	.then((arr) => {
		return arr[0]
	})
}
export function asyncCollectionInsert<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	doc: DBInterface,
): Promise<string> {
	return new Promise((resolve, reject) => {
		collection.insert(doc, (err: any, idInserted) => {
			if (err) reject(err)
			else resolve(idInserted)
		})
	})
}
/** Insert document, and ignore if document already exists */
export function asyncCollectionInsertIgnore<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	doc: DBInterface,
): Promise<string> {
	return new Promise((resolve, reject) => {
		collection.insert(doc, (err: any, idInserted) => {
			if (err) {
				if (err.toString().match(/duplicate key/i)) {
					// @ts-ignore id duplicate, doc._id must exist
					resolve(doc._id)
				} else {
					reject(err)
				}
			} else resolve(idInserted)
		})
	})
}
export function asyncCollectionUpdate<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoSelector<DBInterface> | string,
	modifier: MongoModifier<DBInterface>,
	options?: UpdateOptions

): Promise<number> {
	return new Promise((resolve, reject) => {
		collection.update(selector, modifier, options, (err: any, affectedCount: number) => {
			if (err) reject(err)
			else resolve(affectedCount)
		})
	})
}

export function asyncCollectionUpsert<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoSelector<DBInterface> | string,
	modifier: MongoModifier<DBInterface>,
	options?: UpsertOptions

): Promise<{numberAffected: number, insertedId: string}> {
	return new Promise((resolve, reject) => {
		collection.upsert(selector, modifier, options, (err: any, returnValue: { numberAffected: number, insertedId: string }) => {
			if (err) reject(err)
			else resolve(returnValue)
		})
	})
}

export function asyncCollectionRemove<DocClass, DBInterface> (
	collection: TransformedCollection<DocClass, DBInterface>,
	selector: MongoSelector<DBInterface> | string

): Promise<void> {
	return new Promise((resolve, reject) => {
		collection.remove(selector, (err: any) => {
			if (err) reject(err)
			else resolve()
		})
	})
}
/**
 * Supresses the "UnhandledPromiseRejectionWarning" warning
 * ref: https://stackoverflow.com/questions/40920179/should-i-refrain-from-handling-promise-rejection-asynchronously
 *
 * creds: https://github.com/rsp/node-caught/blob/master/index.js
 */
export const caught: <T>(v: Promise<T>) => Promise<T> = (f => p => (p.catch(f), p))(() => {
	// nothing
})

/**
 * Blocks the fiber until all the Promises have resolved
 */
export const waitForPromiseAll: <T>(ps: Array<Promise<T>>) => Array<T> = Meteor.wrapAsync(function waitForPromises<T> (ps: Array<Promise<T>>, cb: (err: any | null, result?: any) => T) {
	Promise.all(ps)
	.then((result) => {
		cb(null, result)
	})
	.catch((e) => {
		cb(e)
	})
})
export const waitForPromise: <T>(p: Promise<T>) => T = Meteor.wrapAsync(function waitForPromises<T> (p: Promise<T>, cb: (err: any | null, result?: any) => T) {
	Promise.resolve(p)
	.then((result) => {
		cb(null, result)
	})
	.catch((e) => {
		cb(e)
	})
})
export function makePromise<T> (fcn: () => T): Promise<T> {
	return new Promise((resolve, reject) => {
		Meteor.defer(() => {
			try {
				resolve(fcn())
			} catch (e) {
				reject(e)
			}
		})
	})
}
export function mongoWhere<T> (o: any, selector: MongoSelector<T>): boolean {
	let ok = true
	_.each(selector, (s: any, key: string) => {
		if (!ok) return

		try {
			let keyWords = key.split('.')
			if (keyWords.length > 1) {
				let oAttr = o[keyWords[0]]
				if (oAttr && _.isObject(oAttr)) {
					let innerSelector: any = {}
					innerSelector[keyWords.slice(1).join('.')] = s
					ok = mongoWhere(oAttr, innerSelector)
				} else {
					ok = false
				}
			} else if (key === '$or') {
				if (_.isArray(s)) {
					let ok2 = false
					_.each(s, innerSelector => {
						ok2 = ok2 || mongoWhere(o, innerSelector)
					})
					ok = ok2
				} else {
					throw new Error('An $or filter must be an array')
				}
			} else {
				let oAttr = o[key]

				if (_.isObject(s)) {
					if (_.has(s,'$gt')) {
						ok = (oAttr > s.$gt)
					} else if (_.has(s,'$gte')) {
						ok = (oAttr >= s.$gte)
					} else if (_.has(s,'$lt')) {
						ok = (oAttr < s.$lt)
					} else if (_.has(s,'$lte')) {
						ok = (oAttr <= s.$lte)
					} else if (_.has(s,'$eq')) {
						ok = (oAttr === s.$eq)
					} else if (_.has(s,'$ne')) {
						ok = (oAttr !== s.$ne)
					} else if (_.has(s,'$in')) {
						ok = (s.$in.indexOf(oAttr) !== -1)
					} else if (_.has(s,'$nin')) {
						ok = (s.$nin.indexOf(oAttr) === -1)
					} else if (_.has(s,'$exists')) {
						ok = (key in o) === !!s.$exists
					} else if (_.has(s,'$not')) {
						let innerSelector: any = {}
						innerSelector[key] = s.$not
						ok = !mongoWhere(o, innerSelector)
					} else {
						if (_.isObject(oAttr)) {
							ok = mongoWhere(oAttr, s)
						} else {
							ok = false
						}
					}
				} else {
					let innerSelector: any = {}
					innerSelector[key] = { $eq: s }
					ok = mongoWhere(o, innerSelector)
				}
			}
		} catch (e) {
			logger.warn(e)
			ok = false
		}
	})
	return ok
}
/**
 * Mutate a value on a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 * @param mutator Operation to run on the object value
 */
export function mutatePath<T> (obj: Object, path: string, substitutions: Object, mutator: (parentObj: Object, key: string) => T): void {
	if (!path) throw new Meteor.Error(500, 'parameter path missing')

	let attrs = path.split('.')

	let lastAttr = _.last(attrs)
	let attrsExceptLast = attrs.slice(0, -1)

	const generateWildcardAttrInfo = () => {
		const keys = _.filter(_.keys(substitutions), k => k.indexOf(currentPath) === 0)
		if (keys.length === 0) {
			// This might be a bad assumption, but as this is for tests, lets go with it for now
			throw new Meteor.Error(500, `missing parameters for $ in "${path}"`)
		}

		const query: any = {}
		const trimmedSubstitutions: any = {}
		_.each(keys, key => {
			// Create a mini 'query' and new substitutions with trimmed keys
			const remainingKey = key.substr(currentPath.length)
			if (remainingKey.indexOf('$') === -1) {
				query[remainingKey] = substitutions[key]
			} else {
				trimmedSubstitutions[remainingKey] = substitutions[key]
			}
		})

		return {
			query,
			trimmedSubstitutions
		}
	}

	let o = obj
	let currentPath = ''
	for (const attr of attrsExceptLast) {
		if (attr === '$') {
			if (!_.isArray(o)) throw new Meteor.Error(500, 'Object at "' + currentPath + '" is not an array ("' + o + '") (in path "' + path + '")')

			const info = generateWildcardAttrInfo()
			for (const obj of o) {
				// mutate any objects which match
				if (_.isMatch(obj, info.query)) {
					mutatePath(obj, path.substr(currentPath.length + 2), info.trimmedSubstitutions, mutator)
				}
			}

			// Break the outer loop, as it gets handled with the for loop above
			break

		} else {
			if (!_.has(o,attr)) {
				o[attr] = {}
			} else {
				if (!_.isObject(o[attr])) throw new Meteor.Error(500, 'Object propery "' + attr + '" is not an object ("' + o[attr] + '") (in path "' + path + '")')
			}
			o = o[attr]
		}
		currentPath += `${attr}.`
	}
	if (!lastAttr) throw new Meteor.Error(500, 'Bad lastAttr')

	if (lastAttr === '$') {
		if (!_.isArray(o)) throw new Meteor.Error(500, 'Object at "' + currentPath + '" is not an array ("' + o + '") (in path "' + path + '")')

		const info = generateWildcardAttrInfo()
		for (const childPath in o) {
			// mutate any objects which match
			if (_.isMatch(o[childPath], info.query)) {
				mutator(o, childPath)
			}
		}
	} else {
		mutator(o, lastAttr)
	}
}
/**
 * Push a value into a object, and ensure the array exists
 * @param obj Object
 * @param path Path to array in object
 * @param valueToPush Value to push onto array
 */
export function pushOntoPath<T> (obj: Object, path: string, valueToPush: T) {
	let mutator = (o: Object, lastAttr: string) => {
		if (!_.has(o,lastAttr)) {
			o[lastAttr] = []
		} else {
			if (!_.isArray(o[lastAttr])) throw new Meteor.Error(500, 'Object propery "' + lastAttr + '" is not an array ("' + o[lastAttr] + '") (in path "' + path + '")')
		}
		let arr = o[lastAttr]

		arr.push(valueToPush)
		return arr
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Push a value from a object, when the value matches
 * @param obj Object
 * @param path Path to array in object
 * @param valueToPush Value to push onto array
 */
export function pullFromPath<T> (obj: Object, path: string, matchValue: T) {
	let mutator = (o: Object, lastAttr: string) => {
		if (_.has(o, lastAttr)) {
			if (!_.isArray(o[lastAttr])) throw new Meteor.Error(500, 'Object propery "' + lastAttr + '" is not an array ("' + o[lastAttr] + '") (in path "' + path + '")')

			return o[lastAttr] = _.filter(o[lastAttr], (entry: T) => !_.isMatch(entry, matchValue))
		}
	}
	mutatePath(obj, path, {}, mutator)
}
/**
 * Set a value into a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 * @param valueToPush Value to set
 */
export function setOntoPath<T> (obj: Object, path: string, substitutions: Object, valueToSet: T) {
	mutatePath(obj, path, substitutions, (parentObj: Object, key: string) => parentObj[key] = valueToSet)
}
/**
 * Remove a value from a object
 * @param obj Object
 * @param path Path to value in object
 * @param substitutions Object any query values to use instead of $
 */
export function unsetPath (obj: Object, path: string, substitutions: Object) {
	mutatePath(obj, path, substitutions, (parentObj: Object, key: string) => delete parentObj[key])
}
/**
 * Replaces all invalid characters in order to make the path a valid one
 * @param path
 */
export function fixValidPath (path) {
	return path.replace(/([^a-z0-9_.@()-])/ig, '_')
}

/**
 * Thanks to https://github.com/Microsoft/TypeScript/issues/23126#issuecomment-395929162
 */
export type OptionalPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]
export type RequiredPropertyNames<T> = {
	[K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
export type OptionalProperties<T> = Pick<T, OptionalPropertyNames<T>>
export type RequiredProperties<T> = Pick<T, RequiredPropertyNames<T>>

export type Diff<T, U> = T extends U ? never : T  // Remove types from T that are assignable to U
export type KeysByType<TObj, TVal> = Diff<{
	[K in keyof TObj]: TObj[K] extends TVal ? K : never
}[keyof TObj], undefined>

/**
 * Returns the difference between object A and B
 */
type Difference<A, B extends A> = Pick<B, Exclude<keyof B, keyof RequiredProperties<A>>>
/**
 * Somewhat like _.extend, but with strong types & mandated additional properties
 * @param original Object to be extended
 * @param extendObj properties to add
 */
export function extendMandadory<A, B extends A> (original: A, extendObj: Difference<A, B> & Partial<A>): B {
	return _.extend(original, extendObj)
}

export function trimIfString<T extends any> (value: T): T {
	if (_.isString(value)) return value.trim()
	return value
}

export function firstIfArray<T> (value: T | T[] | null | undefined): T | null | undefined
export function firstIfArray<T> (value: T | T[] | null): T | null
export function firstIfArray<T> (value: T | T[] | undefined): T | undefined
export function firstIfArray<T> (value: T | T[]): T
export function firstIfArray<T> (value: any): T {
	return _.isArray(value) ? _.first(value) : value
}


export type WrapAsyncCallback<T> = ((error: Error) => void) & ((error: null, result: T) => void)
