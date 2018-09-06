import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'

Meteor.publish('segmentLineItems', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return SegmentLineItems.find(selector, modifier)
	}
	return this.ready()
})

Meteor.publish('segmentLineItemsSimple', function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0,
			timings: 0,
			// we kind-of need to know the contents, unfortunately
			// content: 0,
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return SegmentLineItems.find(selector, modifier)
	}
	return this.ready()
})