import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { IngestDataCacheObjId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
export * from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'

export const IngestDataCache = createMongoCollection<IngestDataCacheObj>(CollectionName.IngestDataCache)

registerIndex(IngestDataCache, {
	rundownId: 1,
})
