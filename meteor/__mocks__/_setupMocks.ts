import { setLoggerLevel } from '../server/api/logger'
import { runInFiber, Fiber } from './Fibers'
import { resetRandomId } from './random'
import { makeCompatible } from 'meteor-promise'

// This file is run before all tests start.

// Set up how Meteor handles Promises & Fibers:
makeCompatible(Promise, Fiber)

// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('meteor/meteor',					require('./meteor').setup,					{ virtual: true })
jest.mock('meteor/random',					require('./random').setup,					{ virtual: true })
jest.mock('meteor/check',					require('./check').setup,					{ virtual: true })

jest.mock('meteor/meteorhacks:picker',		require('./meteorhacks-picker').setup,		{ virtual: true })
jest.mock('meteor/mdg:validated-method',	require('./validated-method').setup,		{ virtual: true })

jest.mock('meteor/mongo',					require('./mongo').setup,				    { virtual: true })

jest.mock('../server/api/integration/slack', require('./slack').setup, { virtual: true })
jest.mock('../server/api/integration/soap', require('./soap').setup, { virtual: true })
jest.mock('../server/api/integration/rabbitMQ', require('./rabbitMQ').setup, { virtual: true })

require('../server/api/logger.ts')

beforeEach(() => {
	setLoggerLevel('warning')
	// put setLoggerLevel('info') in the beginning of your test to see logs

	resetRandomId()
})
