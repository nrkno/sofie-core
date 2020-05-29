import { Meteor } from 'meteor/meteor'

import { ShowStyleBases, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleBasesSecurity } from '../security/showStyleBases'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.showStyleBases, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBShowStyleBase> = {
		fields: {}
	}
	if (ShowStyleBasesSecurity.allowReadAccess(selector, token, this)) {
		return ShowStyleBases.find(selector, modifier)
	}
	return null
})
