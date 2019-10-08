import { Meteor } from 'meteor/meteor'
import '../../__mocks__/_extendJest'
import { testInFiber } from '../../__mocks__/helpers/jest'
import { syncFunction, Callback, waitTime, syncFunctionIgnore } from '../codeControl'
import { RundownSyncFunctionPriority, rundownSyncFunction } from '../api/ingest/rundownInput'
import { tic, toc, waitForPromise, makePromise, waitForPromiseAll } from '../../lib/lib'

const TIME_FUZZY = 50
const takesALongTimeInner = Meteor.wrapAsync(function takesALongTime (name: string, cb: Callback) {
	setTimeout(() => {
		cb(null, 'result yo ' + name)
	}, 100 - 5) // subtract to account for slowness in Jest
})
describe('codeControl rundown', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	testInFiber('rundownSyncFunction', () => {
		let sync1 = (name: string, priority: RundownSyncFunctionPriority) => {
			return rundownSyncFunction('ro1', priority, () => takesALongTimeInner(name))
		}

		let res: any[] = []
		Meteor.setTimeout(() => {
			res.push(sync1('ingest0', RundownSyncFunctionPriority.Ingest))
		}, 10)
		Meteor.setTimeout(() => {
			res.push(sync1('ingest1', RundownSyncFunctionPriority.Ingest))
		}, 30)
		Meteor.setTimeout(() => {
			res.push(sync1('playout0', RundownSyncFunctionPriority.Playout))
		}, 50)

		jest.runTimersToTime(120)
		expect(res).toEqual([
			'result yo ingest0',
		])

		jest.runTimersToTime(100)
		expect(res).toEqual([
			'result yo ingest0', // Pushed to queue first
			'result yo playout0', // High priority bumps it above ingest1
		])

		jest.runTimersToTime(100)

		expect(res).toEqual([
			'result yo ingest0', // Pushed to queue first
			'result yo playout0', // High priority bumps it above ingest1
			'result yo ingest1',
		])
	})
})
describe('codeControl', () => {
	beforeEach(() => {
		jest.useRealTimers()
	})

	const takesALongTime = syncFunction((name: string) => {
		return takesALongTimeInner(name)
	})
	const takesALongTimeIgnore = syncFunctionIgnore((name: string) => {
		const a = takesALongTimeInner(name)
		return a
	})
	const takesALongTimeInner3 = Meteor.wrapAsync(function takesALongTime (name: string, name2: string, cb: Callback) {
		Meteor.setTimeout(() => {
			cb(null, 'result yo ' + name + name2)
		}, 100)
	})
	const takesALongTime3 = syncFunction((name: string, name2: string) => {
		return takesALongTimeInner3(name, name2)
	}, 'aa$0')

	testInFiber('syncFunction, 1 queue', () => {
		// Running a syncFunction in a queue

		const res: any[] = []
		tic()

		expect(toc()).toBeFuzzy(0, TIME_FUZZY)

		res.push(takesALongTime('run0'))

		expect(toc()).toBeFuzzy(100, TIME_FUZZY)

		res.push(takesALongTime('run0'))

		expect(toc()).toBeFuzzy(200, TIME_FUZZY)
	})

	testInFiber('syncFunction, 2 queues', () => {
		// Running in two parallel queues, run0 and run1:

		const res: any[] = []
		tic()
		// First, just run them sequentially
		res.push(takesALongTime('run0'))
		res.push(takesALongTime('run0'))

		res.push(takesALongTime('run1'))
		res.push(takesALongTime('run1'))

		expect(toc()).toBeFuzzy(400, TIME_FUZZY)

		// Run them in parallell, the 2 queues should kick in now:
		res.splice(0, 99)
		tic()

		const ps = [
			makePromise(() => res.push(takesALongTime('run0'))),
			makePromise(() => res.push(takesALongTime('run0'))),
			makePromise(() => res.push(takesALongTime('run1'))),
			makePromise(() => res.push(takesALongTime('run1'))),
		]
		expect(toc()).toBeFuzzy(0, TIME_FUZZY)
		expect(res).toHaveLength(0)

		waitForPromiseAll(ps)

		expect(toc()).toBeFuzzy(200, TIME_FUZZY)
		expect(res).toMatchObject([
			'result yo run0',
			'result yo run1',
			'result yo run0',
			'result yo run1'
		])
	})
	testInFiber('takesALongTimeIgnore, 2 queues', () => {
		// Running in two parallel queues, run0 and run1:

		const res: any[] = []
		tic()
		// First, just run them sequentially
		res.push(takesALongTimeIgnore('run0'))
		res.push(takesALongTimeIgnore('run0'))

		expect(toc()).toBeFuzzy(200, TIME_FUZZY)
		tic()

		res.push(takesALongTimeIgnore('run1'))
		res.push(takesALongTimeIgnore('run1'))

		expect(toc()).toBeFuzzy(200, TIME_FUZZY)

		// Run them in parallell, the 2 queues should kick in now:
		res.splice(0, 99)
		tic()

		const ps = [
			makePromise(() => res.push(takesALongTimeIgnore('run0'))),
			makePromise(() => res.push(takesALongTimeIgnore('run0'))),
			makePromise(() => res.push(takesALongTimeIgnore('run0'))),
			makePromise(() => res.push(takesALongTimeIgnore('run1'))),
			makePromise(() => res.push(takesALongTimeIgnore('run1'))),
			makePromise(() => res.push(takesALongTimeIgnore('run1'))),
		]
		expect(toc()).toBeFuzzy(0, TIME_FUZZY)
		expect(res).toHaveLength(0)

		waitForPromiseAll(ps)

		expect(toc()).toBeFuzzy(200, TIME_FUZZY)
		expect(res).toMatchObject([
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined
		])
	})
	testInFiber('waitTime', () => {
		tic()

		waitTime(700)

		expect(toc()).toBeFuzzy(700, TIME_FUZZY)
	})
})
