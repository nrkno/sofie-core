import { Meteor } from 'meteor/meteor'

import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.bucketAdLibPieces, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (BucketSecurity.allowReadAccess(selector, token, this)) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})
