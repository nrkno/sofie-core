// import { setLoggerLevel } from '../server/api/logger'
// import { Fiber } from './Fibers'
// import { resetRandomId, randomString } from './random'
// import { makeCompatible } from 'meteor-promise'

import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'

// This file is run before all tests start.

// Set up how Meteor handles Promises & Fibers:
// makeCompatible(Promise, Fiber)

// Mock random ids to be predictable. Imports have to be relative, not via package nmmes for some reason..
jest.mock('../../../corelib/dist/random', (...args) => require('./random').setup(args), {
	virtual: true,
})

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.
// jest.mock('@sofie-automation/corelib/dist/random', (...args) => require('./random').setup(args), { virtual: true })
// import * as lib from '@sofie-automation/corelib/dist/lib'
// jest.spyOn(lib, 'getRandomString').mockImplementation(randomString)

// jest.mock('meteor/meteor', (...args) => require('./meteor').setup(args), { virtual: true })
// jest.mock('meteor/random', (...args) => require('./random').setup(args), { virtual: true })
// jest.mock('meteor/check', (...args) => require('./check').setup(args), { virtual: true })
// jest.mock('meteor/tracker', (...args) => require('./tracker').setup(args), { virtual: true })
// jest.mock('meteor/accounts-base', (...args) => require('./accounts-base').setup(args), { virtual: true })

// jest.mock('meteor/meteorhacks:picker', (...args) => require('./meteorhacks-picker').setup(args), { virtual: true })
// jest.mock('meteor/mdg:validated-method', (...args) => require('./validated-method').setup(args), { virtual: true })
// jest.mock('meteor/kschingiz:meteor-elastic-apm', (...args) => require('./meteor-elastic-apm').setup(args), {
// 	virtual: true,
// })

// jest.mock('meteor/mongo', (...args) => require('./mongo').setup(args), { virtual: true })

// jest.mock('../server/api/integration/slack', (...args) => require('./slack').setup(args), { virtual: true })
// jest.mock('../server/api/integration/soap', (...args) => require('./soap').setup(args), { virtual: true })
// jest.mock('../server/api/integration/rabbitMQ', (...args) => require('./rabbitMQ').setup(args), { virtual: true })

// require('../server/api/logger.ts')

// beforeEach(() => {
// 	setLogLevel(LogLevel.WARNING)
// 	// put setLoggerLevel('info') in the beginning of your test to see logs

// 	resetRandomId()
// })

expect.extend({
	toBeWithinRange(received, floor, ceiling) {
		const pass = received >= floor && received <= ceiling
		return {
			message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
			pass: pass,
		}
	},

	toMatchUserError(received, expected, args) {
		const expectedError = UserError.create(expected)

		const pass =
			received instanceof UserError &&
			received.message.key === expectedError.message.key &&
			(args === undefined || JSON.stringify(args) === JSON.stringify(received.message.args))

		return {
			message: () =>
				`expected ${JSON.stringify(
					received instanceof UserError ? received.message : received
				)} to match ${JSON.stringify(expectedError.message)}`,
			pass: pass,
		}
	},
})

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace jest {
		interface Matchers<R> {
			toBeWithinRange(floor: number, ceiling: number): R

			toMatchUserError(message: UserErrorMessage, args?: { [k: string]: any }): R
		}
	}
}
