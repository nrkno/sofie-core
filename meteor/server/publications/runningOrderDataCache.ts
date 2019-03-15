import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { RunningOrderDataCache } from '../../lib/collections/RunningOrderDataCache'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

// Note: this publication is for dev purposes only (it should probably not be used in production at all)

meteorPublish(PubSub.runningOrderDataCache, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return RunningOrderDataCache.find(selector, modifier)
	}
	return null
})
