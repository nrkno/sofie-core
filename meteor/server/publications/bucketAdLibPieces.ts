import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'

meteorPublish(PubSub.bucketAdLibPieces, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})
