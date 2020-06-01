import { Meteor } from 'meteor/meteor'

import { Blueprints } from '../../lib/collections/Blueprints'
import { BlueprintsSecurity } from '../security/blueprints'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.blueprints, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			code: 0,
		},
	}
	if (BlueprintsSecurity.allowReadAccess(selector, token, this)) {
		return Blueprints.find(selector, modifier)
	}
	return null
})
