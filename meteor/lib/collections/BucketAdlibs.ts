import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
export * from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'

export const BucketAdLibs = createMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)

registerIndex(BucketAdLibs, {
	bucketId: 1,
	studioId: 1,
})
