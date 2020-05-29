import { Meteor } from 'meteor/meteor'

import { ShowStyleVariants, DBShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBasesSecurity } from '../security/showStyleBases'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.showStyleVariants, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBShowStyleVariant> = {
		fields: {}
	}
	if (ShowStyleBasesSecurity.allowReadAccess(selector, token, this)) {
		return ShowStyleVariants.find(selector, modifier)
	}
	return null
})
