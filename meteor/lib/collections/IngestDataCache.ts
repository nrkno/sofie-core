import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { IngestDataCacheObjId, RundownId, SegmentId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { IngestDataCacheObjId }

import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
export * from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'

export const IngestDataCache = createMongoCollection<IngestDataCacheObj, IngestDataCacheObj>('ingestDataCache')
registerCollection('IngestDataCache', IngestDataCache)

registerIndex(IngestDataCache, {
	rundownId: 1,
})
