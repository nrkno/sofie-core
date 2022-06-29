/* eslint-disable @typescript-eslint/no-var-requires */

import './_extendJest'

// This file is run before all tests start.

// Mock random ids to be predictable. Imports have to be relative, not via package nmmes for some reason..
jest.mock('../../../corelib/dist/random', (...args) => require('./random').setup(args), {
	virtual: true,
})
jest.mock('../lib/time', (...args) => require('./time').setup(args), {
	virtual: true,
})
