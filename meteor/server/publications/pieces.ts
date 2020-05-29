import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { Pieces, Piece } from '../../lib/collections/Pieces'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.pieces, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<Piece> = {
		fields: {}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Pieces.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.piecesSimple, function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Piece> = {
		fields: {
			timings: 0,
			// we kind-of need to know the contents, unfortunately
			// content: 0,
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Pieces.find(selector, modifier)
	}
	return null
})
