
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
import { addFoo } from '../tempTest'
import { Meteor } from 'meteor/meteor'
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
