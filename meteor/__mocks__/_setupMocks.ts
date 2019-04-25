import { setLoggerLevel } from '../server/api/logger'

// This file is run before all tests start.
// Add references to all "meteor" mocks below, so that jest resolves the imports properly.

jest.mock('meteor/meteor',					require('./meteor').setup,					{ virtual: true })
jest.mock('meteor/random',					require('./random').setup,					{ virtual: true })

jest.mock('meteor/meteorhacks:picker',		require('./meteorhacks-picker').setup,		{ virtual: true })
jest.mock('meteor/mdg:validated-method',	require('./validated-method').setup,		{ virtual: true })

jest.mock('meteor/mongo',					require('./mongo').setup,				    { virtual: true })

require('../server/api/logger.ts')

beforeEach(() => {
	setLoggerLevel('warning')
	// put setLoggerLevel('info') in the beginning of your test to see logs

})
