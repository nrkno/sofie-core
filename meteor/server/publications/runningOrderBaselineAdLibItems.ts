import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { logger } from '../logging'

Meteor.publish('runningOrderBaselineAdLibItems', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	logger.debug('pub runningOrderBaselineAdLibItems')
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return RunningOrderBaselineAdLibItems.find(selector, modifier)
	}
	return this.ready()
})
