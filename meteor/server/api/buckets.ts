import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { Buckets, Bucket, BucketId } from '../../lib/collections/Buckets'
import { literal, Omit, protectString } from '../../lib/lib'
import { ClientAPI } from '../../lib/api/client'
import { BucketSecurity } from '../security/buckets'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PieceId } from '../../lib/collections/Pieces'
import { StudioId } from '../../lib/collections/Studios'

const DEFAULT_BUCKET_WIDTH = undefined

export namespace BucketsAPI {
	export function removeBucketAdLib(id: PieceId) {
		BucketAdLibs.remove({
			_id: id
		})
		ExpectedMediaItems.remove({
			bucketAdLibPieceId: id
		})
	}

	export function modifyBucket(id: BucketId, bucket: Partial<Omit<Bucket, '_id'>>) {
		Buckets.update(id, {
			$set: _.omit(bucket, ['_id'])
		})
	}

	export function emptyBucket(id: BucketId) {
		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}

	export function createNewBucket(name: string, studioId: StudioId, userId: string | null) {
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

	export function removeBucket(id: BucketId) {
		Buckets.remove(id)
		BucketAdLibs.remove({
			bucketId: id
		})
		ExpectedMediaItems.remove({
			bucketId: id
		})
	}
}
