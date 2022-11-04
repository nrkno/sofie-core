import '../../../../__mocks__/_extendJest'

// import { createManualPromise, sleep } from '@sofie-automation/corelib/dist/lib'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { Meteor } from 'meteor/meteor'
import { ReactiveMongoObserverGroup } from '../observerGroup'

describe('ReactiveMongoObserverGroup', () => {
	test('cleanup on stop', async () => {
		const handle: Meteor.LiveQueryHandle = { stop: jest.fn() }
		const generator = jest.fn(async () => [handle])

		const observerGroup = ReactiveMongoObserverGroup(generator)

		// Ensure we got a sane response
		expect(observerGroup).toBeTruthy()
		expect(observerGroup.stop).toBeTruthy()
		expect(observerGroup.restart).toBeTruthy()

		// Generator should be called immediately
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(0)

		// Stop and it should be gone
		observerGroup.stop()
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(1)

		// Call stop again and it should complain but do nothing
		await expect(async () => observerGroup.stop()).rejects.toThrowMeteor(
			500,
			'ReactiveMongoObserverGroup is not running!'
		)
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(1)
	})

	// test('restarting', async () => {
	// 	const handle: Meteor.LiveQueryHandle = { stop: jest.fn() }
	// 	const generator = jest.fn(async () => [handle])

	// 	const observerGroup = ReactiveMongoObserverGroup(generator)

	// 	// Ensure we got a sane response
	// 	expect(observerGroup).toBeTruthy()
	// 	expect(observerGroup.stop).toBeTruthy()
	// 	expect(observerGroup.restart).toBeTruthy()

	// 	// Generator should be called after a little while
	// 	expect(generator).toHaveBeenCalledTimes(0)
	// 	await sleep(10)
	// 	expect(generator).toHaveBeenCalledTimes(1)
	// 	expect(handle.stop).toHaveBeenCalledTimes(0)

	// 	// Stop and it should be gone
	// 	observerGroup.stop()
	// 	expect(generator).toHaveBeenCalledTimes(1)
	// 	expect(handle.stop).toHaveBeenCalledTimes(1)

	// 	// Call stop again and it should complain but do nothing
	// 	await expect(async () => observerGroup.stop()).rejects.toThrowMeteor(
	// 		500,
	// 		'ReactiveMongoObserverGroup is not running!'
	// 	)
	// 	expect(generator).toHaveBeenCalledTimes(1)
	// 	expect(handle.stop).toHaveBeenCalledTimes(1)
	// })
})
