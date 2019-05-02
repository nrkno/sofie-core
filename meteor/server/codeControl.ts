import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from './logging'
import { Meteor } from 'meteor/meteor'
import { waitForPromise, getHash } from '../lib/lib'

enum syncFunctionFcnStatus {
	WAITING = 0,
	RUNNING = 1,
	DONE = 2
}
type Callback = (err: Error | null, res?: any) => void

interface SyncFunctionFcn {
	id: string
	fcn: Function
	args: Array<any>
	cb: Callback
	timeout: number
	status: syncFunctionFcnStatus
	priority: number
}
/** Queue of syncFunctions */
const syncFunctionFcns: Array<SyncFunctionFcn> = []
/** Start time of running syncFunctions */
const syncFunctionRunningFcns: {[id: string]: number} = {}

/**
 * Only allow one instane of the function (and its arguments) to run at the same time
 * If trying to run several at the same time, the subsequent are put on a queue and run later
 * @param fcn
 * @param id0 (Optional) Id to determine which functions are to wait for each other. Can use "$0" to refer first argument. Example: "myFcn_$0,$1" will let myFcn(0, 0, 13) and myFcn(0, 1, 32) run in parallell, byt not myFcn(0, 0, 13) and myFcn(0, 0, 14)
 * @param timeout (Optional)
 */
export function syncFunction<T extends Function> (fcn: T, id0?: string, timeout: number = 10000, priority: number = 1): T {

	let id1 = Random.id()

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
		logger.debug(`syncFunction: ${id} (${(fcn.name || 'Anonymous function')})`)

		syncFunctionFcns.push({
			id: id,
			fcn: fcn,
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
			let startTime = syncFunctionRunningFcns[id]
			if (!startTime) {
				startTime = syncFunctionRunningFcns[id] = Date.now()
			}
			if (Date.now() - startTime > runningFcn.timeout) {
				// The function has run too long
				logger.error('syncFunction "' + (runningFcn.fcn.name) + '" took too long to evaluate')
				startNext = true
			} else {
				// Do nothing, another is running
			}
 		}

		if (startNext) {
			const nextFcn = _.max(_.filter(group, fcn => fcn.status === syncFunctionFcnStatus.WAITING), fcn => fcn.priority)
			if (nextFcn) {
				nextFcn.status = syncFunctionFcnStatus.RUNNING
				syncFunctionRunningFcns[id] = Date.now()
				Meteor.setTimeout(() => {
					try {
						let result = nextFcn.fcn(...nextFcn.args)
						nextFcn.cb(null, result)
					} catch (e) {
						nextFcn.cb(e)
					}
					delete syncFunctionRunningFcns[id]
					nextFcn.status = syncFunctionFcnStatus.DONE
					evaluateFunctions()
				}, 0)
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
 * like syncFunction, but ignores subsequent, if there is a function queued to be executed already
 * @param fcn
 * @param timeout
 */
export function syncFunctionIgnore<T extends Function> (fcn: T, id0?: string, timeout: number = 10000): () => void {
	let id1 = Random.id()

	let syncFcn = syncFunction(fcn, id0, timeout)

	return (...args) => {
		let id = (id0 ?
			getId(id0, args) :
			getHash(id1 + JSON.stringify(args.join()))
		)

		if (isFunctionQueued(id)) {
			// If it's queued, its going to be run some time in the future
			// Do nothing then...
			logger.debug('Function ' + (fcn.name || 'Anonymous') + ' is already queued to execute, ignoring call.')
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
function assertTimecloseTo (start: number, target: number) {
	let deltaTime = Date.now() - start
	let diff = Math.abs(deltaTime - target)

	if (diff > 50) {
		throw new Meteor.Error(500, `Assert: time too far from ${target} (${deltaTime}) `)
	}
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
const doTest = false
if (doTest) {

	// Tests ---------------------------
	let takesALongTimeInner = Meteor.wrapAsync(function takesALongTime (name: string, cb: Callback) {
		logger.info('fcn start ' + name)
		Meteor.setTimeout(() => {
			logger.info('fcn end')
			cb(null, 'result yo ' + name)
		}, 100)
	})
	let takesALongTime = syncFunction((name: string) => {
		return takesALongTimeInner(name)
	})

	let takesALongTime2 = syncFunction((name: string) => {
		return takesALongTimeInner(name)
	}, 'asdf')

	let takesALongTimeInner3 = Meteor.wrapAsync(function takesALongTime (name: string, name2: string, cb: Callback) {
		logger.info('fcn start ' + name + name2)
		Meteor.setTimeout(() => {
			logger.info('fcn end')
			cb(null, 'result yo ' + name + name2)
		}, 100)
	})

	let takesALongTime3 = syncFunction((name: string, name2: string) => {
		return takesALongTimeInner3(name, name2)
	}, 'aa$0')

	Meteor.setTimeout(() => {
		// test the function
		let start = Date.now()
		logger.info('')
		logger.info('')
		logger.info('')
		logger.info('==================================================')
		logger.info('DEBUG: testing deferAndRateLimit')

		logger.info('Running first round of functions...')
		let res: any[] = []
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		assertTimecloseTo(start, 100)
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Done first runs')
		logger.info('results: ' + res)

		assertTimecloseTo(start, 200)
		start = Date.now()

		logger.info('Running second round of functions...')
		res = []

		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))

		assertTimecloseTo(start, 100)
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Run fcn...')
		res.push(takesALongTime('run1'))
		logger.info('Run fcn...')
		res.push(takesALongTime('run1'))
		logger.info('Done second round')
		logger.info('results: ' + res)

		assertTimecloseTo(start, 500)
		start = Date.now()

		logger.info('Running third round of functions...')
		res = []

		Meteor.setTimeout(() => {
			logger.info('Run fcn from timeout...')
			takesALongTime('run0')
		}, 10)

		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))

		logger.info('Done third round')
		logger.info('results: ' + res)

		assertTimecloseTo(start, 300)
		start = Date.now()
		// test syncFunction id argument:
		logger.info('Running 4th round of functions...')

		Meteor.setTimeout(() => {
			logger.info('Run fcn from timeout...')
			takesALongTime2('run0')
			logger.info('Run fcn from timeout...')
			takesALongTime2('run1')
		}, 10)

		logger.info('Run fcn...')
		takesALongTime2('aaa')
		logger.info('Run fcn...')
		takesALongTime2('run0')
		logger.info('Run fcn...')
		takesALongTime2('run1')

		assertTimecloseTo(start, 500)
		start = Date.now()

		logger.info('Running 5th round of functions...')

		Meteor.setTimeout(() => {
			logger.info('Run fcn from timeout...')
			takesALongTime3('run0', '3')
		}, 10)
		Meteor.setTimeout(() => {
			logger.info('Run fcn from timeout...')
			takesALongTime3('run1', '2')
		}, 10)

		logger.info('Run fcn...')
		takesALongTime3('run0', '1')
		logger.info('Run fcn...')
		takesALongTime3('run1', '4')

		assertTimecloseTo(start, 200)

		logger.info('Run fcn...')
		takesALongTime3('run0', '5')

		assertTimecloseTo(start, 300)

		start = Date.now()

		logger.info('Run all tests successfully!')
	}, 10)
}
