import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../jobs'
import { CacheForPlayout } from './cache'

export async function cleanTimelineDatastore(_context: JobContext, cache: CacheForPlayout): Promise<void> {
	const timeline = cache.Timeline.doc
	const datastore = cache.TimelineDatastore.findFetch({})

	if (!timeline) {
		return
	}

	const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)

	const timelineRefs = timelineObjs
		.filter((o) => o.content.$references) // todo - update timeline types package
		.flatMap((o) => Object.keys(o.content.$references))
	const inactiveKeys = datastore.map((o) => o.key).filter((k) => !!timelineRefs.find((r) => r === k)) // todo - protect some values from being deleted?

	cache.TimelineDatastore.remove({ key: { $in: inactiveKeys } })
}
