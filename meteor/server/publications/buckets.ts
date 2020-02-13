import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Buckets } from '../../lib/collections/Buckets'

meteorPublish(PubSub.buckets, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Buckets.find(selector, modifier)
	}
	return null
})
