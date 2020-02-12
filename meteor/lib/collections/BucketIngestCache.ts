import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IngestRundown, IngestSegment, IngestPart, IngestAdlib } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export interface BucketIngestCacheObj {
	_id: string
	modified: number

	showStyleVariantId: string
	studioId: string

	data: IngestAdlib
}

export const BucketIngestCache: TransformedCollection<BucketIngestCacheObj, BucketIngestCacheObj>
	= createMongoCollection<BucketIngestCacheObj>('bucketIngestCache')
registerCollection('BucketIngestCache', BucketIngestCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		BucketIngestCache._ensureIndex({
			showStyleVariantId: 1,
			studioId: 1
		})
	}
})
