import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { setMeteorMethods, Methods } from '../methods'
import { BucketsAPI } from '../../lib/api/buckets'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { literal } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PieceId } from '../../lib/collections/Pieces'

function removeBucketAdLib(id: PieceId) {
	BucketAdLibs.remove({
		_id: id
	})
	ExpectedMediaItems.remove({
		bucketAdLibPieceId: id
	})
}

function modifyBucket(id: BucketId, bucket: Bucket) {
	Buckets.update(id, _.omit(bucket, ['_id']))
}

function emptyBucket(id: BucketId) {
	BucketAdLibs.remove({
		bucketId: id
	})
	ExpectedMediaItems.remove({
		bucketId: id
	})
}

function createNewBucket(name: string) {
	const newBucket = literal<Bucket>({
		_id: Random.id(),
		name: name
	})

	Buckets.insert(newBucket)

	return newBucket
}

function removeBucket(id: BucketId) {
	Buckets.remove(id)
	BucketAdLibs.remove({
		bucketId: id
	})
	ExpectedMediaItems.remove({
		bucketId: id
	})
}

let methods: Methods = {}
methods[BucketsAPI.methods.modifyBucket] = function (id: BucketId, bucket: Bucket) {
	check(id, String)
	check(bucket, Object)

	return ClientAPI.responseSuccess(modifyBucket(id, bucket))
}
methods[BucketsAPI.methods.removeBucketAdLib] = function (id: PieceId) {
	check(id, String)

	return ClientAPI.responseSuccess(removeBucketAdLib(id))
}
methods[BucketsAPI.methods.emptyBucket] = function (id: BucketId) {
	check(id, String)

	return ClientAPI.responseSuccess(emptyBucket(id))
}
methods[BucketsAPI.methods.createBucket] = function (name: string) {
	check(name, String)

	return ClientAPI.responseSuccess(createNewBucket(name))
}
methods[BucketsAPI.methods.removeBucket] = function (id: BucketId) {
	check(id, String)

	if (BucketSecurity.allowWriteAccess(this.connection.userId)) {
		removeBucket(id)
		return ClientAPI.responseSuccess(undefined)
	}
	throw new Meteor.Error(403, 'Access denied')
}
// Apply methods:
setMeteorMethods(methods)
