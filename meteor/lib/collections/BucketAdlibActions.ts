import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
export * from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'

export const BucketAdLibActions = createMongoCollection<BucketAdLibAction, BucketAdLibAction>('bucketAdlibActions')
registerCollection('BucketAdLibActions', BucketAdLibActions)

registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})
