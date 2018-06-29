import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection, Selector } from './typings/meteor'
import { PeripheralDeviceAPI } from './api/peripheralDevice'
import { logger } from '../lib/logging'

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
				logger.debug('time diff to server: ' + systemTime.diff + ' (stdDev: ' + systemTime.stdDev + ')')
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
