import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { RundownBaselineAdLibPieces, RundownBaselineAdLibItem } from '../../lib/collections/RundownBaselineAdLibPieces'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.rundownBaselineAdLibPieces, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<RundownBaselineAdLibItem> = {
		fields: {}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return RundownBaselineAdLibPieces.find(selector, modifier)
	}
	return null
})
