import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
export { BucketAdLibAction }

export const BucketAdLibActions = createMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions)

registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})
