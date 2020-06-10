import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'
import * as _ from 'underscore'

Meteor.methods({
	logger: (type: string, ...args: any[]) => {
		// @ts-ignore
		let loggerFunction: any = logger[type] || logger.log
		loggerFunction(...args)
	},
})

// This is used when running in tests to minimize the logged output:
export function setLoggerLevel(loggerLevel: 'debug' | 'info' | 'warning' | 'error') {
	logger.transports.console.level = loggerLevel
}
