import { Meteor } from 'meteor/meteor'

import { TimelineSecurity } from '../security/timeline'
import { Timeline } from '../../lib/collections/Timeline'

import { logger } from '../logging'

Meteor.publish('timeline', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	logger.debug('pub timeline', selector)
	if (TimelineSecurity.allowReadAccess(selector, token, this)) {
		return Timeline.find(selector, modifier)
	}
	return this.ready()
})
