import { FindOptions } from '../../lib/collections/lib'
import { BucketSecurity } from '../security/buckets'
import { meteorPublish } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { Bucket } from '../../lib/collections/Buckets'
import { StudioReadAccess } from '../security/studio'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, Match } from 'meteor/check'
import { StudioId, BucketId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

meteorPublish(
	MeteorPubSub.buckets,
	async function (studioId: StudioId, bucketId: BucketId | null, _token: string | undefined) {
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
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibPieces,
	async function (studioId: StudioId, bucketId: BucketId, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, String)
		check(showStyleVariantIds, Array)

		if (isProtectedString(bucketId) && (await BucketSecurity.allowReadAccess(this, bucketId))) {
			return BucketAdLibs.findWithCursor(
				{
					studioId: studioId,
					bucketId: bucketId,
					showStyleVariantId: {
						$in: [null, ...showStyleVariantIds], // null = valid for all variants
					},
				},
				{
					fields: {
						ingestInfo: 0, // This is a large blob, and is not of interest to the UI
					},
				}
			)
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibActions,
	async function (studioId: StudioId, bucketId: BucketId, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, String)
		check(showStyleVariantIds, Array)

		if (isProtectedString(bucketId) && (await BucketSecurity.allowReadAccess(this, bucketId))) {
			return BucketAdLibActions.findWithCursor(
				{
					studioId: studioId,
					bucketId: bucketId,
					showStyleVariantId: {
						$in: [null, ...showStyleVariantIds], // null = valid for all variants
					},
				},
				{
					fields: {
						ingestInfo: 0, // This is a large blob, and is not of interest to the UI
					},
				}
			)
		}
		return null
	}
)
