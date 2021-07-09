import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
export * from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'

export const BucketAdLibs = createMongoCollection<BucketAdLib, BucketAdLib>('bucketAdlibs')
registerCollection('BucketAdLibs', BucketAdLibs)

registerIndex(BucketAdLibs, {
	bucketId: 1,
	studioId: 1,
})
