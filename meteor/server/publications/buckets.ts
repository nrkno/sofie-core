import { Meteor } from 'meteor/meteor'
import { FindOptions } from '../../lib/collections/lib'
import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Bucket } from '../../lib/collections/Buckets'
import { BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { BucketAdLibAction } from '../../lib/collections/BucketAdlibActions'
import { StudioReadAccess } from '../security/studio'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, Match } from 'meteor/check'

meteorPublish(PubSub.buckets, async function (studioId, bucketId, _token) {
	check(studioId, String)
	check(bucketId, Match.Maybe(String))

	const modifier: FindOptions<Bucket> = {
		fields: {},
	}
	if (
		(await StudioReadAccess.studioContent(studioId, this)) ||
		(isProtectedString(bucketId) && bucketId && (await BucketSecurity.allowReadAccess(this, bucketId)))
	) {
		return Buckets.findWithCursor(
			bucketId
				? {
						_id: bucketId,
						studioId,
				  }
				: {
						studioId,
				  },
			modifier
		)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibPieces, async function (selector, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLib> = {
		fields: {},
	}
	if (isProtectedString(selector.bucketId) && (await BucketSecurity.allowReadAccess(this, selector.bucketId))) {
		return BucketAdLibs.findWithCursor(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.bucketAdLibActions, async function (selector, _token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<BucketAdLibAction> = {
		fields: {},
	}
	if (isProtectedString(selector.bucketId) && (await BucketSecurity.allowReadAccess(this, selector.bucketId))) {
		return BucketAdLibActions.findWithCursor(selector, modifier)
	}
	return null
})
