import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'

Meteor.methods({
	logger: (type: string, ...args: any[]) => {
		// @ts-ignore
		const loggerFunction: any = logger[type] || logger.log
		loggerFunction(...args)
	},
})
