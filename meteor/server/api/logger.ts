import { Meteor } from 'meteor/meteor'
import { LOGGER_METHOD_NAME, LeveledLogMethodFixed } from '../../lib/logging'
import { logger } from '../logging'

Meteor.methods({
	[LOGGER_METHOD_NAME]: (type: string, ...args: string[]) => {
		const loggerFunction: LeveledLogMethodFixed = (logger as any)[type] || logger.log

		loggerFunction(args.join(', '))
	},
})
