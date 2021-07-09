import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { SegmentId }

import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
export * from '@sofie-automation/corelib/dist/dataModel/Segment'

export type Segment = DBSegment

export const Segments = createMongoCollection<Segment, DBSegment>('segments')
registerCollection('Segments', Segments)

registerIndex(Segments, {
	rundownId: 1,
	_rank: 1,
})
