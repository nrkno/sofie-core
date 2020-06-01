import { Meteor } from 'meteor/meteor'

import { StudiosSecurity } from '../security/studios'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.externalMessageQueue, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0,
		},
	}
	if (StudiosSecurity.allowReadAccess(selector, token, this)) {
		return ExternalMessageQueue.find(selector, modifier)
	}
	return null
})
