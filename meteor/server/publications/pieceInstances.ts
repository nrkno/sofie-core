import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { PieceInstances, PieceInstance } from '../../lib/collections/PieceInstances'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.pieceInstances, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<PieceInstance> = {
		fields: {}
	}

	// Enforce only not-reset
	selector = selector || {}
	selector.reset = { $ne: true }

	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return PieceInstances.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.pieceInstancesSimple, function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<PieceInstance> = {
		fields: {
			// we kind-of need to know the contents, unfortunately
			// content: 0,
		}
	}

	// Enforce only not-reset
	selector = selector || {}
	selector.reset = { $ne: true }

	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return PieceInstances.find(selector, modifier)
	}
	return null
})
