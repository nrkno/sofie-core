import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/collections/rundowns'
import { Parts } from '../../lib/collections/Parts'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.parts, (selector, token) => {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Parts.find(selector, modifier)
	}
	return null
})
