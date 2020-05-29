import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { Segments, DBSegment } from '../../lib/collections/Segments'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.segments, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<DBSegment> = {
		fields: {}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Segments.find(selector, modifier)
	}
	return null
})
