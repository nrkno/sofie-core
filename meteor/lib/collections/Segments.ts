import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
export * from '@sofie-automation/corelib/dist/dataModel/Segment'

export type Segment = DBSegment

export const Segments = createMongoCollection<Segment>(CollectionName.Segments)

registerIndex(Segments, {
	rundownId: 1,
	_rank: 1,
})
