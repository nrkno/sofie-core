import { Meteor } from 'meteor/meteor'

import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBasesSecurity } from '../security/collections/showStyleBases'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.showStyleVariants, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (ShowStyleBasesSecurity.allowReadAccess(selector, token, this)) {
		return ShowStyleVariants.find(selector, modifier)
	}
	return null
})
