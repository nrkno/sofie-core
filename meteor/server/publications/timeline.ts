import { Meteor } from 'meteor/meteor'

import { TimelineSecurity } from '../security/timeline'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.timeline, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<TimelineObjGeneric> = {
		fields: {}
	}
	if (TimelineSecurity.allowReadAccess(selector, token, this)) {
		return Timeline.find(selector, modifier)
	}
	return null
})
