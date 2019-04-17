import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { RandomMock } from '../../__mocks__/random'

import { runInFiber } from '../../__mocks__/Fibers'

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
