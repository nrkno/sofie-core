import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { Parts, DBPart } from '../../lib/collections/Parts'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.parts, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBPart> = {
		fields: {},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Parts.find(selector, modifier)
	}
	return null
})
