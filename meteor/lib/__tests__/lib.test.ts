import '../../__mocks__/_extendJest'

import { Mongo } from 'meteor/mongo'
import { afterEachInFiber, testInFiber } from '../../__mocks__/helpers/jest'
import { setLogLevel } from '../../server/logging'
import { getCurrentTime, systemTime, formatDateTime, stringifyObjects, protectString, LogLevel } from '../lib'
import { MeteorMock } from '../../__mocks__/meteor'

// require('../../../../../server/api/ingest/mosDevice/api.ts') // include in order to create the Meteor methods needed

describe('lib/lib', () => {
	afterEachInFiber(() => {
		MeteorMock.mockSetServerEnvironment()
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
})
