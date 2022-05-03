import { TimelineDatastoreEntryId, StudioId } from './Ids'

export interface DBTimelineDatastoreEntry {
	_id: TimelineDatastoreEntryId
	studioId: StudioId

	key: string
	value: any

	modified: number

	/** Todo: some sort of history for the UI? */
}
