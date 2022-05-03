import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { TimelineDatastoreEntryId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { TimelineDatastoreEntryId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'
export * from '@sofie-automation/corelib/dist/dataModel/Segment'

export type TimelineDatastoreEntry = DBTimelineDatastoreEntry

export const TimelineDatastore = createMongoCollection<TimelineDatastoreEntry>(CollectionName.TimelineDatastore)

registerIndex(TimelineDatastore, {
	studioId: 1,
})
