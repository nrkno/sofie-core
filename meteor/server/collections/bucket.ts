import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Bucket } from '../../lib/collections/Buckets'
import { createAsyncOnlyMongoCollection } from './collection'
import { registerIndex } from './indices'

export const BucketAdLibActions = createAsyncOnlyMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions)
registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})

export const BucketAdLibs = createAsyncOnlyMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)
registerIndex(BucketAdLibs, {
	bucketId: 1,
	studioId: 1,
})

export const Buckets = createAsyncOnlyMongoCollection<Bucket>(CollectionName.Buckets)
registerIndex(Buckets, {
	studioId: 1,
})
