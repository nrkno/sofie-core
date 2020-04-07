import { Meteor } from 'meteor/meteor'

import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { RundownSecurity } from '../security/collections/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.rundownLayouts, function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownLayouts.find(selector, modifier)
	}
	return null
})
