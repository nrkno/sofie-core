import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { RandomMock } from '../../__mocks__/random'
import { MongoMock } from '../../__mocks__/mongo'

import { runInFiber } from '../../__mocks__/Fibers'
import { Studios, Studio, DBStudio } from '../../lib/collections/Studios'

describe ('Basic test of test environment', () => {

	test('Check that tests will run in fibers correctly', async () => {
		await runInFiber(() => {
			// This code runs in a fiber
			const val = asynchronousFibersFunction(1,2,3)
			expect(val).toEqual(1 + 2 + 3)
		})
	})
	test('Test Meteor Random mock', () => {
		RandomMock.mockIds = ['superRandom']
		expect(tempTestRandom()).toEqual('superRandom')
	})
	test('Test Mock collection data', () => {

		expect(Studios.find().fetch()).toHaveLength(0)

		MongoMock.mockSetData<DBStudio>(Studios, [{
			_id: 'abc',
			name: 'abc',
			mappings: {},
			supportedShowStyleBase: [],
			config: [],
			settings: { mediaPreviewsUrl: '',sofieUrl: '' },
			_rundownVersionHash: 'abc'
		},{
			_id: 'def',
			name: 'def',
			mappings: {},
			supportedShowStyleBase: [],
			config: [],
			settings: { mediaPreviewsUrl: '',sofieUrl: '' },
			_rundownVersionHash: 'def'
		}])

		expect(Studios.find().fetch()).toHaveLength(2)

		expect(Studios.findOne({
			_id: 'def'
		})).toMatchObject({
			_id: 'def'
		})
		Studios.update('abc', {$set: {
			_rundownVersionHash: 'myHash'
		}})
		expect(Studios.findOne({
			name: 'abc'
		})).toMatchObject({
			_rundownVersionHash: 'myHash'
		})

		Studios.remove('def')
		expect(Studios.find().fetch()).toHaveLength(1)

		Studios.insert({
			_id: 'xyz',
			name: 'xyz',
			mappings: {},
			supportedShowStyleBase: [],
			config: [],
			settings: { mediaPreviewsUrl: '',sofieUrl: '' },
			_rundownVersionHash: 'xyz'
		})
		expect(Studios.find().fetch()).toHaveLength(2)

		MongoMock.mockSetData(Studios, null)
		expect(Studios.find().fetch()).toHaveLength(0)
	})
})

function asynchronousFibersFunction (a: number, b: number, c: number): number {
	const val = innerAsynchronousFiberFunction(a, b) + c
	return val
}

const innerAsynchronousFiberFunction = Meteor.wrapAsync((val0, val1, cb) => {
	setTimeout(() => {
		cb(undefined, val0 + val1)
	}, 100)
})

export function tempTestRandom () {
	return Random.id()
}
