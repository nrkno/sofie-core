
// import { Meteor } from 'meteor/meteor'
// Meteor.!
// jest.mock('../tradeSimulator', () => ({
// 	placeOrder: jest.fn()
// }))
// import { placeOrder } from '../tradeSimulator'

// import { placeTradeForUser } from '../placeTradeForUser'

// describe('placeTradeForUser()', () => {
// 	test('allow trades on provider `simulator`', async () => {
// 		console.log('__setUsersQueryResult!!!!!!, 0', __setUsersQueryResult)
// 		__setUsersQueryResult({
// 			username: 'testuser',
// 			tradingAccount: {
// 				provider: 'simulator',
// 			},
// 		})
// 		await placeTradeForUser({})
// 		expect(placeOrder).toBeCalled()
// 	})
// 	test('disallow trades on provider `fidelity`', async () => {
// 		console.log('__setUsersQueryResult!!!!!!, 1', __setUsersQueryResult)
// 		__setUsersQueryResult({
// 			username: 'testuser',
// 			tradingAccount: {
// 				provider: 'fidelity',
// 			},
// 		})
// 		const result = placeTradeForUser({})
// 		await expect(result).rejects.toEqual(
// 			new Error('user testuser is not a simulated account.')
// 		)
// 	})
// })

// @ts-ignore
import { ValidatedMethod } from 'meteor/mdg:validated-method'
import { Meteor } from 'meteor/meteor'

jest.mock('meteor/mdg:validated-method', require('../../__mocks__/validated-method').setup, { virtual: true })
jest.mock('meteor/random', require('../../__mocks__/random').setup, { virtual: true })
jest.mock('meteor/meteorhacks:picker', require('../../__mocks__/meteorhacks-picker').setup, { virtual: true })
jest.mock('meteor/mongo', require('../../__mocks__/mongo').setup, { virtual: true })

Meteor.wrapAsync = jest.fn((param) => {
	return jest.fn(param)
})

import { addFoo, functionToTest } from '../tempTest'
describe('demo', () => {
	it('should add foo', () => {
		addFoo()
		expect(Meteor.loginWithPassword).toHaveBeenCalledWith('sene', 'nsie')
		expect(ValidatedMethod).toHaveBeenCalledWith({
			name: 'Foo.add',
			run: jasmine.any(Function),
			validate: undefined,
		})
	})
})

test('functionToTest', async () => {
	// (running in fiber)
	functionToTest('myValue', function (err, value) {
		expect(err).toEqual(null)
		expect(value).toEqual('myValue')
	})
})
