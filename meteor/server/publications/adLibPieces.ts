import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { AdLibPieces, AdLibPiece } from '../../lib/collections/AdLibPieces'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.adLibPieces, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<AdLibPiece> = {
		fields: {},
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return AdLibPieces.find(selector, modifier)
	}
	return null
})
