import { Meteor } from 'meteor/meteor'

import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { FindOptions } from '../../lib/typings/meteor'

meteorPublish(PubSub.buckets, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (BucketSecurity.allowReadAccess(selector, token, this)) {
		return Buckets.find(selector, modifier)
	}
	return null
})
