import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBTimelineDatastoreEntry } from '@sofie-automation/corelib/dist/dataModel/TimelineDatastore'

export type TimelineDatastoreEntry = DBTimelineDatastoreEntry

export const TimelineDatastore = createMongoCollection<TimelineDatastoreEntry>(CollectionName.TimelineDatastore)

registerIndex(TimelineDatastore, {
	studioId: 1,
})
