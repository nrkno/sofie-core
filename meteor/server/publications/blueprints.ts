import { Meteor } from 'meteor/meteor'

import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { BlueprintsSecurity } from '../security/blueprints'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.blueprints, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Blueprint> = {
		fields: {
			code: 0,
		},
	}
	if (BlueprintsSecurity.allowReadAccess(selector, token, this)) {
		return Blueprints.find(selector, modifier)
	}
	return null
})
