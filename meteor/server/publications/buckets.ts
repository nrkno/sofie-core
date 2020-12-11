import { Meteor } from 'meteor/meteor'
import { MongoQuery } from '../../lib/typings/meteor'

import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { StudioReadAccess } from '../security/studio'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { FindOptions } from '../../lib/typings/meteor'
import { BucketAdLibActions, BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'

meteorPublish(PubSub.buckets, function(selector: MongoQuery<BucketAdLibAction>, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (
		(selector.studioId && StudioReadAccess.studioContent(selector, this)) ||
		(selector._id && BucketSecurity.allowReadAccess(selector, token, this))
	) {
		return Buckets.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibPieces, function(selector: MongoQuery<BucketAdLibAction>, token) {
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

meteorPublish(PubSub.bucketAdLibActions, function(selector: MongoQuery<BucketAdLibAction>, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (
		(selector.studioId && StudioReadAccess.studioContent(selector, this)) ||
		(selector.bucketId && BucketSecurity.allowReadAccess({ _id: selector.bucketId }, token, this))
	) {
		return BucketAdLibActions.find(selector, modifier)
	}
	return null
})
