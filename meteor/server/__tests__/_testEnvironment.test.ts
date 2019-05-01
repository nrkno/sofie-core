import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { RandomMock } from '../../__mocks__/random'
import { MongoMock } from '../../__mocks__/mongo'

import { Studios, DBStudio } from '../../lib/collections/Studios'
import { waitForPromise } from '../../lib/lib'
import { testInFiber } from '../../__mocks__/helpers/jest'

describe('Basic test of test environment', () => {

	testInFiber('Check that tests will run in fibers correctly', () => {
		// This code runs in a fiber
		const val = asynchronousFibersFunction(1,2,3)
		expect(val).toEqual(1 + 2 + 3)
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

		const observer = Studios.find({ _id: 'abc' }).observeChanges({})
		expect(observer).toBeTruthy()

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

		observer.stop()

		MongoMock.mockSetData(Studios, null)
		expect(Studios.find().fetch()).toHaveLength(0)
	})
	testInFiber('Promises in fibers', () => {

		let p = new Promise((resolve) => {
			setTimeout(() => {
				resolve('yup')
			}, 10)
		})

		const result = waitForPromise(p)

		expect(result).toEqual('yup')
	})
})

function asynchronousFibersFunction (a: number, b: number, c: number): number {
	const val = innerAsynchronousFiberFunction(a, b) + c
	return val
}

const innerAsynchronousFiberFunction = Meteor.wrapAsync((val0, val1, cb) => {
	setTimeout(() => {
		cb(undefined, val0 + val1)
	}, 10)
})

export function tempTestRandom () {
	return Random.id()
}
