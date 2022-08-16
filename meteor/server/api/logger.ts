import { Meteor } from 'meteor/meteor'
import { LeveledLogMethodFixed } from '../../lib/logging'
import { logger } from '../logging'

Meteor.methods({
	logger: (type: string, ...args: string[]) => {
		const loggerFunction: LeveledLogMethodFixed = logger[type] || logger.log

		loggerFunction(args.join(', '))
	},
})
