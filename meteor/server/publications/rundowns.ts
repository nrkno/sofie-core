import { Meteor } from 'meteor/meteor'

import { Rundowns, DBRundown } from '../../lib/collections/Rundowns'
import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.rundowns, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<DBRundown> = {
		fields: {}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Rundowns.find(selector, modifier)
	}
	return null
})
