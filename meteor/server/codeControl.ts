import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from './logging'
import { Meteor } from 'meteor/meteor'
import { waitForPromise, getHash } from '../lib/lib'
import * as callerModule from 'caller-module'

enum syncFunctionFcnStatus {
	WAITING = 0,
	RUNNING = 1,
	DONE = 2,
	TIMEOUT = 3
}
export type Callback = (err: Error | null, res?: any) => void

interface SyncFunctionFcn {
	id: string
	fcn: Function
	name: string
	args: Array<any>
	cb: Callback
	timeout: number
	status: syncFunctionFcnStatus
	priority: number
	started?: number
}
/** Queue of syncFunctions */
const syncFunctionFcns: Array<SyncFunctionFcn> = []

function getFunctionName<T extends Function> (parent: Function, fcn: T): string {
	if (fcn.name) {
		return fcn.name
	} else {
		let name = 'Anonymous'
		for (let i = 4; i < 10; i++) {
			try {
				const newName = callerModule.GetCallerModule(i).callSite.getFunctionName()
				if (newName) {
					if (newName !== 'args') {
						name += `(${newName})`
						break
					}
				} else {
					name += `(Anonymous)`
				}
			} catch (e) {
				// Probably reached the top?
				break
			}
		}

		return name
	}
}

/**
 * Only allow one instane of the function (and its arguments) to run at the same time
 * If trying to run several at the same time, the subsequent are put on a queue and run later
 * @param fcn
 * @param id0 (Optional) Id to determine which functions are to wait for each other. Can use "$0" to refer first argument. Example: "myFcn_$0,$1" will let myFcn(0, 0, 13) and myFcn(0, 1, 32) run in parallell, byt not myFcn(0, 0, 13) and myFcn(0, 0, 14)
 * @param timeout (Optional)
 */
export function syncFunction<T extends Function> (fcn: T, id0?: string, timeout: number = 10000, priority: number = 1): T {
	let id1 = Random.id()
	return syncFunctionInner(id1, fcn, id0, timeout, priority)
}
function syncFunctionInner<T extends Function> (id1: string, fcn: T, id0?: string, timeout: number = 10000, priority: number = 1): T {
	return Meteor.wrapAsync((...args0: any[]) => {

		let args = args0.slice(0,-1)
		// @ts-ignore
		let cb: Callback = _.last(args0) // the callback is the last argument

		if (!cb) throw new Meteor.Error(500, 'Callback is not defined')
		if (!_.isFunction(cb)) {
			logger.info(cb)
			throw new Meteor.Error(500, 'Callback is not a function, it is a ' + typeof cb)
		}

		let id = (id0 ?
			getId(id0, args) :
			getHash(id1 + JSON.stringify(args.join()))
		)
		const name = getFunctionName(this, fcn)
		logger.debug(`syncFunction: ${id} (${name})`)
		syncFunctionFcns.push({
			id: id,
			fcn: fcn,
			name: name,
			args: args,
			cb: cb,
			timeout: timeout,
			status: syncFunctionFcnStatus.WAITING,
			priority: priority
		})
		evaluateFunctions()
	})
}
function evaluateFunctions () {
	const groups = _.groupBy(syncFunctionFcns, fcn => fcn.id)
	_.each(groups, (group, id) => {
		const runningFcn = _.find(group, fcn => fcn.status === syncFunctionFcnStatus.RUNNING)
		let startNext = false
		if (runningFcn) {
			let startTime = runningFcn.started
			if (!startTime) {
				startTime = runningFcn.started = Date.now()
			}
			if (Date.now() - startTime > runningFcn.timeout) {
				// The function has run too long
				logger.error(`syncFunction "${runningFcn.name}" took too long to evaluate`)
				runningFcn.status = syncFunctionFcnStatus.TIMEOUT
				startNext = true
			} else {
				// Do nothing, another is running
			}
 		} else {
			startNext = true
		}

		if (startNext) {
			const nextFcn = _.max(_.filter(group, fcn => fcn.status === syncFunctionFcnStatus.WAITING), fcn => fcn.priority)
			if (_.isObject(nextFcn)) {
				nextFcn.status = syncFunctionFcnStatus.RUNNING
				nextFcn.started = Date.now()
				Meteor.setTimeout(() => {
					try {
						let result = nextFcn.fcn(...nextFcn.args)
						nextFcn.cb(null, result)
					} catch (e) {
						nextFcn.cb(e)
					}
					if (nextFcn.status === syncFunctionFcnStatus.TIMEOUT) {
						const duration = nextFcn.started ? Date.now() - nextFcn.started : 0
						logger.error(`syncFunction ${nextFcn.id} "${nextFcn.name}" completed after timeout. took ${duration}ms`)
					}
					nextFcn.status = syncFunctionFcnStatus.DONE
					evaluateFunctions()
				}, 0)
				Meteor.setTimeout(() => {
					if (nextFcn.status === syncFunctionFcnStatus.RUNNING) {
						logger.error(`syncFunction "${nextFcn.name}" took too long to evaluate`)
						nextFcn.status = syncFunctionFcnStatus.TIMEOUT
						evaluateFunctions()
					}
				}, nextFcn.timeout)
			}
		}
	})
	for (let i = syncFunctionFcns.length - 1; i >= 0 ; i--) {
		if (syncFunctionFcns[i].status === syncFunctionFcnStatus.DONE) {
			syncFunctionFcns.splice(i, 1)
		}
	}
}
function isFunctionQueued (id: string): boolean {
	let queued = _.find(syncFunctionFcns, fcn => {
		return (fcn.id === id && fcn.status === syncFunctionFcnStatus.WAITING)
	})
	return !!queued
}
/**
 * like syncFunction, but ignores subsequent calls, if there is a function queued to be executed already
 * @param fcn
 * @param timeout
 */
export function syncFunctionIgnore<A> (fcn: (a: A) => any, id0?: string, timeout?: number): (a: A) => void
export function syncFunctionIgnore<A, B> (fcn: (a: A, b: B) => any, id0?: string, timeout?: number): (a: A, b: B) => void
export function syncFunctionIgnore<A, B, C> (fcn: (a: A, b: B, c: C) => any, id0?: string, timeout?: number): (a: A, b: B, c: C) => void
export function syncFunctionIgnore<A, B, C, D> (fcn: (a: A, b: B, c: C, d: D) => any, id0?: string, timeout?: number): (a: A, b: B, c: C, d: D) => void
export function syncFunctionIgnore<T extends Function> (fcn: T, id0?: string, timeout: number = 10000): () => void {
	let id1 = Random.id()

	let syncFcn = syncFunctionInner(id1, fcn, id0, timeout)

	return (...args) => {
		let id = (id0 ?
			getId(id0, args) :
			getHash(id1 + JSON.stringify(args.join()))
		)
		if (isFunctionQueued(id)) {
			// If it's queued, its going to be run some time in the future
			// Do nothing then...
			const name = getFunctionName(this, fcn)
			logger.debug('Function ' + (name || 'Anonymous') + ' is already queued to execute, ignoring call.')
		} else {
			syncFcn(...args)
		}
	}
}
function getId (id: string, args: Array<any>): string {
	let str: string = id

	if (str.indexOf('$') !== -1) {
		_.each(args, (val, key) => {
			str = str.replace('$' + key, JSON.stringify(val))
		})
		return getHash(str)
	}
	return str
}
/**
 * Wait for specified time
 * @param time
 */
export function waitTime (time: number) {
	let p = new Promise((resolve) => {
		Meteor.setTimeout(resolve, time)
	})
	waitForPromise(p)
}
