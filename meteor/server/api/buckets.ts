import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { literal, Omit, protectString } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs, BucketAdLib } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PieceId } from '../../lib/collections/Pieces'
import { StudioId, Studios } from '../../lib/collections/Studios'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'

const DEFAULT_BUCKET_WIDTH = undefined

export namespace BucketsAPI {
	export function removeBucketAdLib(id: PieceId) {
		const adlib = BucketAdLibs.findOne(id)
		if (!adlib) throw new Meteor.Error(404, `Bucket Ad-Lib not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess(adlib.bucketId)) throw new Meteor.Error(403, `Not allowed to edit bucket: ${adlib.bucketId}`)

		BucketAdLibs.remove({
			_id: id
		})
		ExpectedMediaItems.remove({
			bucketAdLibPieceId: id
		})
	}

	export function modifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		const oldBucket = Buckets.findOne(id)
		if (!oldBucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess(id)) throw new Meteor.Error(403, `Not allowed to edit bucket: ${bucket.bucketId}`)

		Buckets.update(id, {
			$set: _.omit(bucket, ['_id'])
		})
	}

	export function emptyBucket(id: BucketId) {
		const bucket = Buckets.findOne(id)
		if (!bucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess(id)) throw new Meteor.Error(403, `Not allowed to edit bucket: ${id}`)

		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}
	export function createNewBucket(name: string, studioId: StudioId, userId: string | null) {
		const studio = Studios.findOne(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio not found: ${studioId}`)

		const heaviestBucket = Buckets.find({
			studioId
		}, {
			sort: {
				_rank: 1
			},
			fields: {
				_rank: 1
			}
		}).fetch().reverse()[0]

		let rank = 1
		if (heaviestBucket) {
			rank = heaviestBucket._rank + 1
		}

		const newBucket = literal<Bucket>({
			_id: protectString(Random.id()),
			_rank: rank,
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

	export function modifyBucketAdLib(id: PieceId, adlib: Partial<Omit<BucketAdLib, '_id'>>) {
		check(id, String)
		check(adlib, Object)

		const oldAdLib = BucketAdLibs.findOne(id)
		if (!oldAdLib) {
			throw new Meteor.Error(404, `Bucket AdLib not found: ${id}`)
		}

		if (!BucketSecurity.allowWriteAccess(oldAdLib.bucketId)) {
			throw new Meteor.Error(403, 'Access denied')
		}
		if (adlib.bucketId && !BucketSecurity.allowWriteAccess(adlib.bucketId)) {
			throw new Meteor.Error(403, 'Access denied')
		}

		if (adlib.bucketId && !Buckets.findOne(adlib.bucketId)) {
			throw new Meteor.Error(`Could not find bucket: "${adlib.bucketId}"`)
		}

		if (adlib.showStyleVariantId && !ShowStyleVariants.findOne(adlib.showStyleVariantId)) {
			throw new Meteor.Error(`Could not find show style variant: "${adlib.showStyleVariantId}"`)
		}

		if (adlib.studioId && !Studios.findOne(adlib.studioId)) {
			throw new Meteor.Error(`Could not find studio: "${adlib.studioId}"`)
		}

		BucketAdLibs.update(id, {
			$set: _.omit(adlib, ['_id'])
		})
	}

	export function removeBucket(id: BucketId) {
		const bucket = Buckets.findOne(id)
		if (!bucket) throw new Meteor.Error(404, `Bucket not found: ${id}`)

		if (!BucketSecurity.allowWriteAccess(id)) throw new Meteor.Error(403, `Not allowed to edit bucket: ${id}`)

		Buckets.remove(id)
		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}
}
