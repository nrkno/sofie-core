import { Meteor } from 'meteor/meteor'
import { MongoQuery, FindOptions } from '../../lib/typings/meteor'
import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { BucketAdLibActions, BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { StudioReadAccess } from '../security/studio'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'

meteorPublish(PubSub.buckets, function (selector: MongoQuery<Bucket>, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (
		(isProtectedString(selector.studioId) && selector.studioId && StudioReadAccess.studioContent(selector, this)) ||
		(isProtectedString(selector._id) && selector._id && BucketSecurity.allowReadAccess(this, selector._id))
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
	if (isProtectedString(selector.bucketId) && BucketSecurity.allowReadAccess(this, selector.bucketId)) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibActions, function (selector: MongoQuery<BucketAdLibAction>, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLibAction> = {
		fields: {},
	}
	if (isProtectedString(selector.bucketId) && BucketSecurity.allowReadAccess(this, selector.bucketId)) {
		return BucketAdLibActions.find(selector, modifier)
	}
	return null
})
