import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Bucket } from '../../lib/collections/Buckets'
import { createAsyncMongoCollection } from './collection'
import { registerIndex } from './indices'

export const BucketAdLibActions = createAsyncMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions)
registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})

export const BucketAdLibs = createAsyncMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)
registerIndex(BucketAdLibs, {
	bucketId: 1,
	studioId: 1,
})

export const Buckets = createAsyncMongoCollection<Bucket>(CollectionName.Buckets)
registerIndex(Buckets, {
	studioId: 1,
})
