import { Meteor } from 'meteor/meteor'
import { IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { ProtectedString, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { ShowStyleVariantId } from './ShowStyleVariants'
import { StudioId } from './Studios'

export type BucketIngestCacheObjId = ProtectedString<'BucketIngestCacheObjId'>

export interface BucketIngestCacheObj {
	_id: BucketIngestCacheObjId
	modified: number

	showStyleVariantId: ShowStyleVariantId
	studioId: StudioId

	data: IngestAdlib
}

export const BucketIngestCache: TransformedCollection<
	BucketIngestCacheObj,
	BucketIngestCacheObj
> = createMongoCollection<BucketIngestCacheObj>('bucketIngestCache')
registerCollection('BucketIngestCache', BucketIngestCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		BucketIngestCache._ensureIndex({
			showStyleVariantId: 1,
			studioId: 1,
		})
	}
})
