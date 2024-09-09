import '../../__mocks__/_extendJest'

import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { afterEachInFiber, testInFiber } from '../../__mocks__/helpers/jest'
import { setLogLevel } from '../../server/logging'
import {
	getCurrentTime,
	systemTime,
	formatDateTime,
	stringifyObjects,
	partial,
	protectString,
	equalSets,
	equivalentArrays,
	LogLevel,
	makePromise,
	MeteorPromiseApply,
} from '../lib'
import { MeteorMock } from '../../__mocks__/meteor'
import { MeteorDebugMethods } from '../../server/methods'
import { Settings } from '../Settings'

// require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create the Meteor methods needed

describe('lib/lib', () => {
	afterEachInFiber(() => {
		MeteorMock.mockSetServerEnvironment()
	})

	testInFiber('MeteorPromiseApply', async () => {
		// set up method:
		Settings.enableUserAccounts = false
		MeteorDebugMethods({
			myMethod: async (value1: string, value2: string) => {
				// Do an async operation, to ensure that asynchronous operations work:
				const v = await new Promise((resolve) => {
					setTimeout(() => {
						resolve(value1 + value2)
					}, 10)
				})
				return v
			},
		})
		const pValue: any = MeteorPromiseApply('myMethod', ['myValue', 'AAA']).catch((e) => {
			throw e
		})
		expect(pValue).toHaveProperty('then') // be a promise
		const value = await pValue
		expect(value).toEqual('myValueAAA')
	})
	testInFiber('getCurrentTime', () => {
		systemTime.diff = 5439
		MeteorMock.mockSetClientEnvironment()
		expect(getCurrentTime() / 1000).toBeCloseTo((Date.now() - 5439) / 1000, 1)
		MeteorMock.mockSetServerEnvironment()
		expect(getCurrentTime() / 1000).toBeCloseTo(Date.now() / 1000, 1)
	})

	testInFiber('formatDateTime', () => {
		expect(formatDateTime(1556194064374)).toMatch(/2019-04-\d{2} \d{2}:\d{2}:\d{2}/)
	})
	testInFiber('stringifyObjects', () => {
		const o: any = {
			a: 1,
			b: {
				c: '1',
				d: {
					e: 2,
				},
			},
		}
		expect(stringifyObjects(o)).toEqual(stringifyObjects(o))
	})
	testInFiber('mongowhere', () => {
		setLogLevel(LogLevel.DEBUG)

		// mongoWhere is used my Collection mock
		const MyCollection = new Mongo.Collection<any>('mycollection')

		expect(MyCollection.findOne()).toBeFalsy()

		MyCollection.insert({
			_id: protectString('id0'),
			name: 'abc',
			rank: 0,
		})
		MyCollection.insert({
			_id: protectString('id1'),
			name: 'abc',
			rank: 1,
		})
		MyCollection.insert({
			_id: protectString('id2'),
			name: 'abcd',
			rank: 2,
		})
		MyCollection.insert({
			_id: protectString('id3'),
			name: 'abcd',
			rank: 3,
		})
		MyCollection.insert({
			_id: protectString('id4'),
			name: 'xyz',
			rank: 4,
		})
		MyCollection.insert({
			_id: protectString('id5'),
			name: 'xyz',
			rank: 5,
		})

		expect(MyCollection.find().fetch()).toHaveLength(6)

		expect(MyCollection.find({ _id: protectString('id3') }).fetch()).toHaveLength(1)
		expect(MyCollection.find({ _id: protectString('id99') }).fetch()).toHaveLength(0)

		expect(MyCollection.find({ name: 'abcd' }).fetch()).toHaveLength(2)
		expect(MyCollection.find({ name: 'xyz' }).fetch()).toHaveLength(2)
		expect(MyCollection.find({ name: { $in: ['abc', 'xyz'] } }).fetch()).toHaveLength(4)

		expect(MyCollection.find({ rank: { $gt: 2 } }).fetch()).toHaveLength(3)
		expect(MyCollection.find({ rank: { $gte: 2 } }).fetch()).toHaveLength(4)

		expect(MyCollection.find({ rank: { $lt: 3 } }).fetch()).toHaveLength(3)
		expect(MyCollection.find({ rank: { $lte: 3 } }).fetch()).toHaveLength(4)
	})
	// testInFiber('getRank', () => {
	// 	const objs: { _rank: number }[] = [
	// 		{ _rank: 0 },
	// 		{ _rank: 10 },
	// 		{ _rank: 20 },
	// 		{ _rank: 21 },
	// 		{ _rank: 22 },
	// 		{ _rank: 23 },
	// 	]

	// 	// First:
	// 	expect(getRank(null, objs[0])).toEqual(-0.5)
	// 	// Insert two:
	// 	expect(getRank(null, objs[0], 0, 2)).toEqual(-0.6666666666666667)
	// 	expect(getRank(null, objs[0], 1, 2)).toEqual(-0.33333333333333337)

	// 	// Center:
	// 	expect(getRank(objs[1], objs[2])).toEqual(15)
	// 	// Insert three:
	// 	expect(getRank(objs[1], objs[2], 0, 3)).toEqual(12.5)
	// 	expect(getRank(objs[1], objs[2], 1, 3)).toEqual(15)
	// 	expect(getRank(objs[1], objs[2], 2, 3)).toEqual(17.5)

	// 	// Last:
	// 	expect(getRank(objs[5], undefined)).toEqual(23.5)
	// 	// Insert three:
	// 	expect(getRank(objs[5], undefined, 0, 3)).toEqual(23.25)
	// 	expect(getRank(objs[5], undefined, 1, 3)).toEqual(23.5)
	// 	expect(getRank(objs[5], undefined, 2, 3)).toEqual(23.75)

	// 	// Insert in empty list
	// 	expect(getRank(undefined, undefined)).toEqual(0.5)

	// 	// Insert three:
	// 	expect(getRank(undefined, undefined, 0, 2)).toEqual(0.3333333333333333)
	// 	expect(getRank(undefined, undefined, 1, 2)).toEqual(0.6666666666666666)
	// })
	testInFiber('partial', () => {
		const o = {
			a: 1,
			b: 'asdf',
			c: {
				d: 1,
			},
			e: null,
			f: undefined,
		}
		expect(partial(o)).toEqual(o) // The function only affects typings
	})
	testInFiber('formatDateTime', () => {
		if (process.platform === 'win32') {
			// Due to a bug in how timezones are handled in Windows & Node, we just have to skip these tests when running tests locally..
			expect(0).toEqual(0)
			return
		}

		expect(new Date().getTimezoneOffset()).toBe(0) // Timezone is UTC

		expect(formatDateTime(1578295344070)).toBe('2020-01-06 07:22:24')
		expect(formatDateTime(1578389166594)).toBe('2020-01-07 09:26:06')
		expect(formatDateTime(2579299201000)).toBe('2051-09-26 00:00:01')
		expect(formatDateTime(2579299200000)).toBe('2051-09-26 00:00:00')
		expect(formatDateTime(2579299344070)).toBe('2051-09-26 00:02:24')
	})

	testInFiber('equalSets', () => {
		expect(equalSets(new Set(['a', 'b', 'c']), new Set(['c', 'b', 'a']))).toBe(true)
		expect(equalSets(new Set(['a', 'b', 'c']), new Set(['d', 'b', 'a']))).toBe(false)
	})
	testInFiber('equivalentArrays', () => {
		expect(equivalentArrays(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true)
		expect(equivalentArrays(['a', 'b', 'c'], ['b', 'g', 'a'])).toBe(false)
	})
	testInFiber('makePromise', async () => {
		let a = 0
		// Check that they are executed in order:
		expect(
			await Promise.all([
				makePromise(() => {
					return a++
				}),
				makePromise(() => {
					return a++
				}),
			])
		).toStrictEqual([0, 1])

		// Handle an instant throw:
		await expect(
			makePromise(() => {
				throw new Error('asdf')
			})
		).rejects.toMatchToString(/asdf/)

		// Handle a delayed throw:
		const delayedThrow = Meteor.wrapAsync((callback: (err: any, result: any) => void) => {
			setTimeout(() => {
				callback(new Error('asdf'), null)
			}, 10)
		})
		await expect(
			makePromise(() => {
				delayedThrow()
			})
		).rejects.toMatchToString(/asdf/)
	})
})
