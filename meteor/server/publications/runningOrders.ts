import { Meteor } from 'meteor/meteor'

import { RunningOrders } from '../../lib/collections/RunningOrders'
import { RunningOrderSecurity } from '../security/runningOrders'

Meteor.publish('runningOrders', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	console.log('pub runningOrders')
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return RunningOrders.find(selector, modifier)
	}
	return this.ready()
})
