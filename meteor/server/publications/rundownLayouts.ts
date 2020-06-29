import { Meteor } from 'meteor/meteor'

import { RundownLayouts, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.rundownLayouts, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<RundownLayoutBase> = {
		fields: {},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownLayouts.find(selector, modifier)
	}
	return null
})
