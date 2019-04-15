import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { RundownDataCache } from '../../lib/collections/RundownDataCache'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

// Note: this publication is for dev purposes only (it should probably not be used in production at all)

meteorPublish(PubSub.rundownDataCache, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownDataCache.find(selector, modifier)
	}
	return null
})
