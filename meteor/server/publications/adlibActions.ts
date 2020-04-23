import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.adLibActions, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return AdLibActions.find(selector, modifier)
	}
	return null
})
