/* eslint-disable @typescript-eslint/no-var-requires */

import './_extendJest'

// This file is run before all tests start.

// Mock random ids to be predictable. Imports have to be relative, not via package nmmes for some reason..
jest.mock('nanoid')

jest.mock('../lib/time', (...args) => require('./time').setup(args), {
	virtual: true,
})

jest.mock('../events/integration/rabbitMQ', (...args) => require('./rabbitMQ').setup(args), { virtual: true })
jest.mock('../events/integration/slack', (...args) => require('./slack').setup(args), { virtual: true })
