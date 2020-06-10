import { testInFiber } from '../../__mocks__/helpers/jest'
import { logger } from '../logging'

describe('lib/logger', () => {
	testInFiber('logger', () => {
		expect(typeof logger.error).toEqual('function')
		expect(typeof logger.warn).toEqual('function')
		expect(typeof logger.help).toEqual('function')
		expect(typeof logger.info).toEqual('function')
		expect(typeof logger.debug).toEqual('function')
	})
})
