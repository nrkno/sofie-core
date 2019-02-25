import { RandomMock } from '../../__mocks__/random'
import { ValidatedMethodMock } from '../../__mocks__/validated-method'
const Fiber = require('fibers')

import { tempTestRandom, tempTestAsync } from '../tempTest'
import { runInFiber } from '../../__mocks__/Fibers'

jest.mock('meteor/mdg:validated-method', require('../../__mocks__/validated-method').setup, { virtual: true })
jest.mock('meteor/random', require('../../__mocks__/random').setup, { virtual: true })
jest.mock('meteor/meteor', require('../../__mocks__/meteor').setup, { virtual: true })

describe ('tempTest', () => {

	test('tempTestRandom', () => {
		// @ts-ignore
		RandomMock.mockIds = ['superRandom']

		expect(tempTestRandom()).toEqual('superRandom')
	})

	test('tempTestAsync', async () => {

		await runInFiber(() => {
			// This code runs in a fiber
			// console.log('a0')
			const val = tempTestAsync(1,2,3)
			// console.log('e')

			expect(val).toEqual(1 + 2 + 3)

		})
	})

})
