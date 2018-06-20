import { Meteor } from 'meteor/meteor'

import { TimelineSecurity } from '../security/timeline'
import { Timeline } from '../../lib/collections/Timeline'


Meteor.publish('timeline', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (TimelineSecurity.allowReadAccess(selector, token, this)) {
		return Timeline.find(selector, modifier)
	}
	return this.ready()
})
