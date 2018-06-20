import { Meteor } from 'meteor/meteor'

import { RuntimeFunctionsSecurity } from '../security/runtimeFunctions'
import { RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'
import { logger } from '../logging'

Meteor.publish('runtimeFunctions', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	logger.debug('pub runtimeFunctions')
	if (RuntimeFunctionsSecurity.allowReadAccess(selector, token, this)) {
		return RuntimeFunctions.find(selector, modifier)
	}
	return this.ready()
})
