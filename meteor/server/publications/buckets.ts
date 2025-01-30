import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { meteorPublish } from './lib/lib'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, Match } from 'meteor/check'
import { StudioId, BucketId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

meteorPublish(
	CorelibPubSub.buckets,
	async function (studioId: StudioId, bucketId: BucketId | null, _token: string | undefined) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		const modifier: FindOptions<Bucket> = {
			fields: {},
		}

		return Buckets.findWithCursor(
			{
				_id: bucketId ?? undefined,
				studioId,
			},
			modifier
		)
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibPieces,
	async function (studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		return BucketAdLibs.findWithCursor(
			{
				studioId: studioId,
				bucketId: bucketId ?? undefined,
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
)

meteorPublish(
	CorelibPubSub.bucketAdLibActions,
	async function (studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		return BucketAdLibActions.findWithCursor(
			{
				studioId: studioId,
				bucketId: bucketId ?? undefined,
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
)
