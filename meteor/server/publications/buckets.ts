import { Meteor } from 'meteor/meteor'
import { MongoQuery } from '../../lib/typings/meteor'

import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { FindOptions } from '../../lib/typings/meteor'
import { BucketAdLibActions, BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { StudioReadAccess } from '../security/studio'

meteorPublish(PubSub.buckets, function (selector: MongoQuery<Bucket>, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (
		(typeof selector.studioId === 'string' &&
			selector.studioId &&
			StudioReadAccess.studioContent(selector, this)) ||
		(typeof selector._id === 'string' && selector._id && BucketSecurity.allowReadAccess(this, selector._id))
	) {
		return Buckets.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibPieces, function (selector: MongoQuery<BucketAdLib>, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (typeof selector.bucketId === 'string' && BucketSecurity.allowReadAccess(this, selector.bucketId)) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibActions, function (selector: MongoQuery<BucketAdLibAction>, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (typeof selector.bucketId === 'string' && BucketSecurity.allowReadAccess(this, selector.bucketId)) {
		return BucketAdLibActions.find(selector, modifier)
	}
	return null
})
