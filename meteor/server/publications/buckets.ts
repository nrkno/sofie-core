import { Meteor } from 'meteor/meteor'
import { FindOptions } from '../../lib/typings/meteor'
import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { BucketAdLibActions, BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { StudioReadAccess } from '../security/studio'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'

meteorPublish(PubSub.buckets, async function (selector, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (
		(isProtectedString(selector.studioId) &&
			selector.studioId &&
			(await StudioReadAccess.studioContent(selector.studioId, this))) ||
		(isProtectedString(selector._id) && selector._id && (await BucketSecurity.allowReadAccess(this, selector._id)))
	) {
		return Buckets.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibPieces, async function (selector, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (isProtectedString(selector.bucketId) && (await BucketSecurity.allowReadAccess(this, selector.bucketId))) {
		return BucketAdLibs.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibActions, async function (selector, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLibAction> = {
		fields: {},
	}
	if (isProtectedString(selector.bucketId) && (await BucketSecurity.allowReadAccess(this, selector.bucketId))) {
		return BucketAdLibActions.find(selector, modifier)
	}
	return null
})
