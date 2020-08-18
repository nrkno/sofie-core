import { Meteor } from 'meteor/meteor'
import { PubSub } from '../../lib/api/pubsub'
import { BucketAdLib, BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { FindOptions } from '../../lib/typings/meteor'
import { BucketSecurity } from '../security/buckets'
import { StudioReadAccess } from '../security/studio'
import { meteorPublish } from './lib'

meteorPublish(PubSub.bucketAdLibPieces, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (
		(selector.studioId && StudioReadAccess.studioContent(selector, this)) ||
		(selector.bucketId && BucketSecurity.allowReadAccess({ _id: selector.bucketId }, token, this))
	) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})
