import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { setMeteorMethods, Methods } from '../methods'
import { BucketsAPI } from '../../lib/api/buckets'
import { Buckets, Bucket } from '../../lib/collections/Buckets'
import { literal } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'

const DEFAULT_BUCKET_WIDTH = 9

function removeBucketAdLib(id: string) {
	BucketAdLibs.remove({
		_id: id
	})
	ExpectedMediaItems.remove({
		bucketAdLibPieceId: id
	})
}

function modifyBucket(id: string, bucket: Bucket) {
	Buckets.update(id,
		_.omit(bucket, [ '_id' ])
	)
}

function emptyBucket(id: string) {
	BucketAdLibs.remove({
		bucketId: id
	})
	ExpectedMediaItems.remove({
		bucketId: id
	})
}

function createNewBucket(name: string, studioId: string, userId: string | null) {
	const newBucket = literal<Bucket>({
		_id: Random.id(),
		name: name,
		studioId,
		userId,
		width: DEFAULT_BUCKET_WIDTH,
		buttonWidthScale: 1,
		buttonHeightScale: 1
	})

	Buckets.insert(newBucket)

	return newBucket
}

function removeBucket(id: string) {
	Buckets.remove(id)
	BucketAdLibs.remove({
		bucketId: id
	})
	ExpectedMediaItems.remove({
		bucketId: id
	})
}

let methods: Methods = {}
methods[BucketsAPI.methods.modifyBucket] = function (id: string, bucket: Bucket) {
	check(id, String)
	check(bucket, Object)

	if (BucketSecurity.allowWriteAccess(id)) {
		return ClientAPI.responseSuccess(modifyBucket(id, bucket))
	}
	throw new Meteor.Error(403, 'Access denied')
}
methods[BucketsAPI.methods.removeBucketAdLib] = function (id: string) {
	check(id, String)

	return ClientAPI.responseSuccess(removeBucketAdLib(id))
}
methods[BucketsAPI.methods.emptyBucket] = function (id: string) {
	check(id, String)

	return ClientAPI.responseSuccess(emptyBucket(id))
}
methods[BucketsAPI.methods.createBucket] = function (name: string, studioId: string) {
	check(name, String)
	check(studioId, String)

	return ClientAPI.responseSuccess(createNewBucket(name, studioId, this.connection.userId))
}
methods[BucketsAPI.methods.removeBucket] = function (id: string) {
	check(id, String)

	if (BucketSecurity.allowWriteAccess(id)) {
		removeBucket(id)
		return ClientAPI.responseSuccess()
	}
	throw new Meteor.Error(403, 'Access denied')
}
// Apply methods:
setMeteorMethods(methods)