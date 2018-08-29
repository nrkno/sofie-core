import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { getHash } from '../server/lib'
import { logger } from './logging'

enum syncFunctionFcnStatus {
	WAITING = 0,
	RUNNING = 1,
	DONE = 2
}
type Callback = (err, res?: any) => void

interface SyncFunctionFcn {
	id: string
	fcn: Function
	args: Array<any>
	cb: Callback
	timeout: number
	status: syncFunctionFcnStatus
}
const syncFunctionFcns: Array<SyncFunctionFcn> = []
const syncFunctionRunningFcns: {[id: string]: number} = {}
/**
 * Only allow one instane of the function (and its arguments) to run at the same time
 * If trying to run several at the same time, the subsequent are put on a queue and run later
 * @param fcn
 * @param timeout
 */
export function syncFunction<T extends Function> (fcn: T, id0?: string, timeout: number = 10000): T {

	let id1 = Random.id()

	return Meteor.wrapAsync((...args0) => {

		let args = args0.slice(0,-1)
		// @ts-ignore
		let cb: Callback = _.last(args0) // the callback is the last argument

		if (!cb) throw new Meteor.Error(500, 'Callback is not defined')
		if (!_.isFunction(cb)) {
			logger.info(cb)
			throw new Meteor.Error(500, 'Callback is not a function, it is a ' + typeof cb)
		}

		let id = (id0 ?
			id0 :
			getHash(id1 + JSON.stringify(args.join()))
		)

		syncFunctionFcns.push({
			id: id,
			fcn: fcn,
			args: args,
			cb: cb,
			timeout: timeout,
			status: syncFunctionFcnStatus.WAITING
		})
		evaluateFunctions()
	})
}
function evaluateFunctions () {

	_.each(syncFunctionFcns, (o, key) => {
		if (o.status === syncFunctionFcnStatus.WAITING) {

			let runIt = false
			// is the function running?
			if (syncFunctionRunningFcns[o.id]) {
				// Yes, an instance of the function is running
				let timeSinceStart = Date.now() - syncFunctionRunningFcns[o.id]
				if (timeSinceStart > o.timeout) {
					// The function has run too long
					logger.error('syncFunction "' + (o.fcn.name) + '" took too long to evaluate')
					runIt = true
				} else {
					// Do nothing, another is running
				}
			} else {
				// No other instance of the funciton is running
				runIt = true
			}
			if (runIt) {
				o.status = syncFunctionFcnStatus.RUNNING
				syncFunctionRunningFcns[o.id] = Date.now()
				Meteor.setTimeout(() => {
					try {
						let result = o.fcn(...o.args)
						o.cb(null, result)
					} catch (e) {
						o.cb(e)
					}
					delete syncFunctionRunningFcns[o.id]
					o.status = syncFunctionFcnStatus.DONE
					evaluateFunctions()
				},0)
			}
		}
	})
	for (let i = syncFunctionFcns.length - 1; i >= 0 ; i-- ) {
		if (syncFunctionFcns[i].status === syncFunctionFcnStatus.DONE) {
			syncFunctionFcns.splice(i, 1)
		}
	}
}
function isFunctionQueued (id: string): boolean {
	let queued = _.find(syncFunctionFcns, (o, key) => {
		return (o.id === id && o.status === syncFunctionFcnStatus.WAITING)
	})
	return !!queued
}
/**
 * like syncFunction, but ignores subsequent calls
 * @param fcn
 * @param timeout
 */
export function syncFunctionIgnore<T extends Function> (fcn: T, id0?: string, timeout: number = 10000): () => void {
	let id1 = Random.id()

	let syncFcn = syncFunction(fcn, id0, timeout)

	return (...args) => {
		let id = (id0 ?
			id0 :
			getHash(id1 + JSON.stringify(args.join()))
		)

		if (isFunctionQueued(id)) {
			// If it's queued, its going to be run some time in the future
			// Do nothing then...
		} else {
			syncFcn(...args)
		}
	}
}
const doTest = false
if (doTest) {

	// Tests ---------------------------
	let takesALongTimeInner = Meteor.wrapAsync(function takesALongTime (name, cb) {
		logger.info('fcn start ' + name)
		Meteor.setTimeout(() => {
			logger.info('fcn end')
			cb(null, 'result yo ' + name)
		}, 100)
	})
	let takesALongTime = syncFunction((name: string) => {
		return takesALongTimeInner(name)
	})

	Meteor.setTimeout(() => {
		// test the function
		logger.info('')
		logger.info('')
		logger.info('')
		logger.info('==================================================')
		logger.info('DEBUG: testing deferAndRateLimit')

		logger.info('Running first round of functions...')
		let res: any[] = []
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
		logger.info('Done first runs')
		logger.info('results: ' + res)

		logger.info('Running second round of functions...')
		res = []

		logger.info('Run fcn...')
		res.push(takesALongTime('run0'))
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

	}, 10)
}
