import { Meteor } from 'meteor/meteor'

import { StudiosSecurity } from '../security/studios'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.externalMessageQueue, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<ExternalMessageQueueObj> = {
		fields: {}
	}
	if (StudiosSecurity.allowReadAccess(selector, token, this)) {
		return ExternalMessageQueue.find(selector, modifier)
	}
	return null
})
