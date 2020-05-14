import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { PartInstances } from '../../lib/collections/PartInstances'

meteorPublish(PubSub.partInstances, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}

	// Enforce only not-reset
	selector = selector || {}
	selector.reset = { $ne: true }

	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return PartInstances.find(selector, modifier)
	}
	return null
})
