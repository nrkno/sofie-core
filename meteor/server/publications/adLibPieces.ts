import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.adLibPieces, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0,
		},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return AdLibPieces.find(selector, modifier)
	}
	return null
})
