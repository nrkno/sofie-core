import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { AdLibActions, AdLibAction } from '../../lib/collections/AdLibActions'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.adLibActions, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<AdLibAction> = {
		fields: {},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return AdLibActions.find(selector, modifier)
	}
	return null
})
