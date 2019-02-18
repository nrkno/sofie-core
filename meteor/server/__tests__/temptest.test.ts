import { RandomMock } from '../../__mocks__/random'
import { ValidatedMethodMock } from '../../__mocks__/validated-method'

import { tempTestRandom } from '../tempTest'

jest.mock('meteor/random', () => {
	const r = require('../../__mocks__/random')
	return {
		Random: r.RandomMock
	}
}, { virtual: true })

jest.mock('meteor/mdg:validated-method', () => {
	const r = require('../../__mocks__/validated-method')
	return {
		ValidatedMethod: r.ValidatedMethodMock
	}
}, { virtual: true })

describe ('tempTest', () => {

	test('tempTestRandom', () => {
		// @ts-ignore
		RandomMock.mockIds = ['superRandom']

		expect(tempTestRandom()).toEqual('superRandom')
	})
})
