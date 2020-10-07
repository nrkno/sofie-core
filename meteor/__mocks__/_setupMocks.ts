import { setLoggerLevel } from '../server/api/logger'
import { Fiber } from './Fibers'
import { resetRandomId } from './random'
import { makeCompatible } from 'meteor-promise'

// This file is run before all tests start.

// Set up how Meteor handles Promises & Fibers:
makeCompatible(Promise, Fiber)

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('meteor/meteor', (...args) => require('./meteor').setup(args), { virtual: true })
jest.mock('meteor/random', (...args) => require('./random').setup(args), { virtual: true })
jest.mock('meteor/check', (...args) => require('./check').setup(args), { virtual: true })
jest.mock('meteor/accounts-base', (...args) => require('./accounts-base').setup(args), { virtual: true })

jest.mock('meteor/meteorhacks:picker', (...args) => require('./meteorhacks-picker').setup(args), { virtual: true })
jest.mock('meteor/mdg:validated-method', (...args) => require('./validated-method').setup(args), { virtual: true })
jest.mock('meteor/kschingiz:meteor-elastic-apm', (...args) => require('./meteor-elastic-apm').setup(args), {
	virtual: true,
})

jest.mock('meteor/mongo', (...args) => require('./mongo').setup(args), { virtual: true })

jest.mock('../server/api/integration/slack', (...args) => require('./slack').setup(args), { virtual: true })
jest.mock('../server/api/integration/soap', (...args) => require('./soap').setup(args), { virtual: true })
jest.mock('../server/api/integration/rabbitMQ', (...args) => require('./rabbitMQ').setup(args), { virtual: true })

require('../server/api/logger.ts')

beforeEach(() => {
	setLoggerLevel('warning')
	// put setLoggerLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
