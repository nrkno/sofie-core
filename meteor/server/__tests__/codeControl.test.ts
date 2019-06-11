import { Meteor } from 'meteor/meteor'
import { logger } from '../../lib/logging'
import { syncFunction, Callback, waitTime } from '../codeControl'
import { rundownSyncFunction, RundownSyncFunctionPriority } from '../api/ingest/rundownInput'
import { testInFiber } from '../../__mocks__/helpers/jest'

function assertTimecloseTo (start: number, target: number) {
	let deltaTime = Date.now() - start
	let diff = Math.abs(deltaTime - target)

	if (diff > 50) {
		throw new Meteor.Error(500, `Assert: time too far from ${target} (${deltaTime}) `)
	}
}

describe('codeControl', () => {
	jest.useFakeTimers()

	let takesALongTimeInner = Meteor.wrapAsync(function takesALongTime (name: string, cb: Callback) {
		// console.log('fcn start ' + name)
		setTimeout(() => {
			// console.log('fcn end')
			cb(null, 'result yo ' + name)
		}, 100)
	})

	testInFiber('rundownSyncFunction', () => {
		let sync1 = (name: string, priority: RundownSyncFunctionPriority) => {
			return rundownSyncFunction('ro1', priority, () => takesALongTimeInner(name))
		}

		let res: any[] = []
		Meteor.setTimeout(() => {
			res.push(sync1('abc', RundownSyncFunctionPriority.Ingest))
		}, 30)
		Meteor.setTimeout(() => {
			res.push(sync1('zzz', RundownSyncFunctionPriority.Playout))
		}, 50)
		Meteor.setTimeout(() => {
			res.push(sync1('def', RundownSyncFunctionPriority.Ingest))
		}, 10)

		jest.runTimersToTime(120)
		expect(res).toEqual([
			'result yo def',
		])

		jest.runTimersToTime(100)
		expect(res).toEqual([
			'result yo def', // Pushed to queue first
			'result yo zzz', // High priority bumps it above abc
		])

		jest.runTimersToTime(100)
		expect(res).toEqual([
			'result yo def', // Pushed to queue first
			'result yo zzz', // High priority bumps it above abc
			'result yo abc',
		])
	})

	// testInFiber('syncFunction', () => { // TODO - what does this test do?
	// 	let takesALongTime = syncFunction((name: string) => {
	// 		return takesALongTimeInner(name)
	// 	})

	// 	let takesALongTime2 = syncFunction((name: string) => {
	// 		return takesALongTimeInner(name)
	// 	}, 'asdf')

	// 	let takesALongTimeInner3 = Meteor.wrapAsync(function takesALongTime (name: string, name2: string, cb: Callback) {
	// 		logger.info('fcn start ' + name + name2)
	// 		Meteor.setTimeout(() => {
	// 			logger.info('fcn end')
	// 			cb(null, 'result yo ' + name + name2)
	// 		}, 100)
	// 	})

	// 	let takesALongTime3 = syncFunction((name: string, name2: string) => {
	// 		return takesALongTimeInner3(name, name2)
	// 	}, 'aa$0')

	// 	Meteor.setTimeout(() => {
	// 		// test the function
	// 		let start = Date.now()
	// 		logger.info('')
	// 		logger.info('')
	// 		logger.info('')
	// 		logger.info('==================================================')
	// 		logger.info('DEBUG: testing deferAndRateLimit')

	// 		logger.info('Running first round of functions...')
	// 		let res: any[] = []
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))
	// 		assertTimecloseTo(start, 100)
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))
	// 		logger.info('Done first runs')
	// 		logger.info('results: ' + res)

	// 		assertTimecloseTo(start, 200)
	// 		start = Date.now()

	// 		logger.info('Running second round of functions...')
	// 		res = []

	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))

	// 		assertTimecloseTo(start, 100)
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run1'))
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run1'))
	// 		logger.info('Done second round')
	// 		logger.info('results: ' + res)

	// 		assertTimecloseTo(start, 500)
	// 		start = Date.now()

	// 		logger.info('Running third round of functions...')
	// 		res = []

	// 		Meteor.setTimeout(() => {
	// 			logger.info('Run fcn from timeout...')
	// 			takesALongTime('run0')
	// 		}, 10)

	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))
	// 		logger.info('Run fcn...')
	// 		res.push(takesALongTime('run0'))

	// 		logger.info('Done third round')
	// 		logger.info('results: ' + res)

	// 		assertTimecloseTo(start, 300)
	// 		start = Date.now()
	// 		// test syncFunction id argument:
	// 		logger.info('Running 4th round of functions...')

	// 		Meteor.setTimeout(() => {
	// 			logger.info('Run fcn from timeout...')
	// 			takesALongTime2('run0')
	// 			logger.info('Run fcn from timeout...')
	// 			takesALongTime2('run1')
	// 		}, 10)

	// 		logger.info('Run fcn...')
	// 		takesALongTime2('aaa')
	// 		logger.info('Run fcn...')
	// 		takesALongTime2('run0')
	// 		logger.info('Run fcn...')
	// 		takesALongTime2('run1')

	// 		assertTimecloseTo(start, 500)
	// 		start = Date.now()

	// 		logger.info('Running 5th round of functions...')

	// 		Meteor.setTimeout(() => {
	// 			logger.info('Run fcn from timeout...')
	// 			takesALongTime3('run0', '3')
	// 		}, 10)
	// 		Meteor.setTimeout(() => {
	// 			logger.info('Run fcn from timeout...')
	// 			takesALongTime3('run1', '2')
	// 		}, 10)

	// 		logger.info('Run fcn...')
	// 		takesALongTime3('run0', '1')
	// 		logger.info('Run fcn...')
	// 		takesALongTime3('run1', '4')

	// 		assertTimecloseTo(start, 200)

	// 		logger.info('Run fcn...')
	// 		takesALongTime3('run0', '5')

	// 		assertTimecloseTo(start, 300)

	// 		start = Date.now()

	// 		logger.info('Run all tests successfully!')
	// 	}, 10)

	// 	waitTime(2500)
	// })
})
