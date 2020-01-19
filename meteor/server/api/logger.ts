import { setMeteorMethods } from '../../lib/methods'
import { logger } from '../logging'
import * as _ from 'underscore'

setMeteorMethods({
	'logger': (type: string, ...args: any[]) => {
		// @ts-ignore
		let l: any = logger[type] || logger.log
		l(...args)
	}
})

// This is used when running in tests to minimize the logged output:
export function setLoggerLevel (loggerLevel: 'debug' | 'info' | 'warning' | 'error') {
	logger.transports.console.level = loggerLevel
}
