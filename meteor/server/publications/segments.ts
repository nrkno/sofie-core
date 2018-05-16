import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { Segments } from '../../lib/collections/Segments'

Meteor.publish('segments', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	console.log('pub segments')
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return Segments.find(selector, modifier)
	}
	return this.ready()
})
