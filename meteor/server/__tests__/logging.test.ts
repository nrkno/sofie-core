import { testInFiber } from '../../__mocks__/helpers/jest'
import { supressLogging } from '../../__mocks__/helpers/lib'
import { SupressLogMessages } from '../../__mocks__/suppressLogging'
import { logger } from '../logging'

describe('server/logger', () => {
	testInFiber('supress errors', async () => {
		const logMessages = () => {
			logger.debug('This is a debug message')
			logger.info('This is an info message')
			logger.warn('This is a warn message')
			logger.error('This is an error message')
		}
		// These should suppress all messages from being logged:
		await supressLogging(logMessages)

		SupressLogMessages.suppressLogMessage(/This is an error message/i)
		// These should suppress all but errors:
		await supressLogging(logMessages, true)
		expect(1).toBe(1)
	})
})
