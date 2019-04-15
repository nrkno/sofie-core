import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.segmentLineItems, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return SegmentLineItems.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.segmentLineItemsSimple, function (selector, token) {
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
	return null
})
