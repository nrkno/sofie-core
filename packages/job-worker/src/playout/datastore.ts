import { DatastorePersistenceMode } from '@sofie-automation/blueprints-integration'
import { StudioId, TimelineDatastoreEntryId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../jobs'
import { CacheForPlayout } from './cache'

export function getDatastoreId(studioId: StudioId, key: string): TimelineDatastoreEntryId {
	return protectString<TimelineDatastoreEntryId>(`${studioId}_${key}`)
}

/** Remove documents in the TimelineDatastore collection where mode is temporary and has no references from the timeline */
export async function cleanTimelineDatastore(context: JobContext, cache: CacheForPlayout): Promise<void> {
	const timeline = cache.Timeline.doc

	if (!timeline) {
		return
	}

	const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)

	// find all references currently on the timeline
	const timelineRefs = timelineObjs
		.filter((o) => o.content.$references)
		.flatMap((o) => Object.values(o.content.$references || {}).map((r) => r.datastoreKey)) // todo - this seems like it would be quite slow

	await context.directCollections.TimelineDatastores.remove({
		_id: {
			$nin: timelineRefs.map((r) => getDatastoreId(context.studioId, r)),
		},
		studioId: context.studioId,
		mode: DatastorePersistenceMode.Temporary,
	})
}
