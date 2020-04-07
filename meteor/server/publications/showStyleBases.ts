import { Meteor } from 'meteor/meteor'

import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleBasesSecurity } from '../security/collections/showStyleBases'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.showStyleBases, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (ShowStyleBasesSecurity.allowReadAccess(selector, token, this)) {
		return ShowStyleBases.find(selector, modifier)
	}
	return null
})
