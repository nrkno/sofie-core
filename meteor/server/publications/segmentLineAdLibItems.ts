import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'

Meteor.publish('segmentLineAdLibItems', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return SegmentLineAdLibItems.find(selector, modifier)
	}
	return this.ready()
})
