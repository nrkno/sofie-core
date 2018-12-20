import { Meteor } from 'meteor/meteor'

import { RunningOrders } from '../../lib/collections/RunningOrders'
import { RunningOrderSecurity } from '../security/runningOrders'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.runningOrders, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return RunningOrders.find(selector, modifier)
	}
	return null
})
