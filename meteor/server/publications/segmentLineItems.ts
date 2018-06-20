import { Meteor } from 'meteor/meteor'

import { RunningOrderSecurity } from '../security/runningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { logger } from '../logging'

Meteor.publish('segmentLineItems', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	logger.debug('pub segmentLineItems')
	if (RunningOrderSecurity.allowReadAccess(selector, token, this)) {
		return SegmentLineItems.find(selector, modifier)
	}
	return this.ready()
})
