import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { RundownBaselineAdLibItems } from '../../lib/collections/RundownBaselineAdLibItems'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.rundownBaselineAdLibItems, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownBaselineAdLibItems.find(selector, modifier)
	}
	return null
})
