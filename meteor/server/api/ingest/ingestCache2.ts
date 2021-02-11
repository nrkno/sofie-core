import * as _ from 'underscore'
import { asyncCollectionFindFetch, protectString, unprotectString } from '../../../lib/lib'
import {
	IngestDataCacheObj,
	IngestCacheType,
	IngestDataCacheObjPart,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
	IngestDataCacheObjId,
	IngestDataCache,
} from '../../../lib/collections/IngestDataCache'
import { getSegmentId, getPartId } from './lib'
import { RundownId } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { profiler } from '../profiler'
import { LocalIngestPart, LocalIngestRundown, LocalIngestSegment } from './ingestCache'
import { DbCacheWriteCollection, DbCacheReadCollection } from '../../cache/CacheCollection'
import { saveIntoCache } from '../../cache/lib'

export type RundownIngestDataCacheCollection = DbCacheWriteCollection<IngestDataCacheObj, IngestDataCacheObj>
export type ReadOnlyRundownIngestDataCacheCollection = DbCacheReadCollection<IngestDataCacheObj, IngestDataCacheObj>

/** TODO-CACHE the `_id`s used here are consistent and predictable, so this should be rewritten to operate more directly on the cache with the ids instead */

export async function loadCachedRundownData(
	cache: ReadOnlyRundownIngestDataCacheCollection | null,
	rundownId: RundownId
): Promise<LocalIngestRundown | undefined> {
	const span = profiler.startSpan('ingest.ingestCache.loadCachedRundownData')

	const cacheEntries =
		cache?.findFetch({}) ?? (await asyncCollectionFindFetch(IngestDataCache, { rundownId: rundownId }))

	const cachedRundown = cacheEntries.find((e) => e.type === IngestCacheType.RUNDOWN)
	if (!cachedRundown) {
		span?.end()
		return undefined
	}

	const ingestRundown = cachedRundown.data as LocalIngestRundown
	ingestRundown.modified = cachedRundown.modified

	const segmentMap = _.groupBy(cacheEntries, (e) => e.segmentId)
	_.each(segmentMap, (objs) => {
		const segmentEntry = objs.find((e) => e.type === IngestCacheType.SEGMENT)
		if (segmentEntry) {
			const ingestSegment = segmentEntry.data as LocalIngestSegment
			ingestSegment.modified = segmentEntry.modified

			_.each(objs, (entry) => {
				if (entry.type === IngestCacheType.PART) {
					const ingestPart = entry.data as LocalIngestPart
					ingestPart.modified = entry.modified

					ingestSegment.parts.push(ingestPart)
				}
			})

			ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)
			ingestRundown.segments.push(ingestSegment)
		}
	})

	ingestRundown.segments = _.sortBy(ingestRundown.segments, (s) => s.rank)

	span?.end()
	return ingestRundown
}

export function saveRundownCache(
	cache: RundownIngestDataCacheCollection,
	rundownId: RundownId,
	ingestRundown: LocalIngestRundown
) {
	// cache the Data:
	const cacheEntries: IngestDataCacheObj[] = generateCacheForRundown(rundownId, ingestRundown)
	saveIntoCache<IngestDataCacheObj, IngestDataCacheObj>(cache, {}, cacheEntries)
}
function generateCacheForRundown(rundownId: RundownId, ingestRundown: LocalIngestRundown): IngestDataCacheObj[] {
	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = []
	const rundown: IngestDataCacheObjRundown = {
		_id: protectString<IngestDataCacheObjId>(unprotectString(rundownId)),
		type: IngestCacheType.RUNDOWN,
		rundownId: rundownId,
		modified: ingestRundown.modified,
		data: {
			..._.omit(ingestRundown, 'modified'),
			segments: [], // omit the segments, they come as separate objects
		},
	}
	cacheEntries.push(rundown)
	_.each(ingestRundown.segments, (segment) => cacheEntries.push(...generateCacheForSegment(rundownId, segment)))
	return cacheEntries
}
function generateCacheForSegment(rundownId: RundownId, ingestSegment: LocalIngestSegment): IngestDataCacheObj[] {
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
	const cacheEntries: Array<IngestDataCacheObjSegment | IngestDataCacheObjPart> = []

	const segment: IngestDataCacheObjSegment = {
		_id: protectString<IngestDataCacheObjId>(`${rundownId}_${segmentId}`),
		type: IngestCacheType.SEGMENT,
		rundownId: rundownId,
		segmentId: segmentId,
		modified: ingestSegment.modified,
		data: {
			..._.omit(ingestSegment, 'modified'),
			parts: [], // omit the parts, they come as separate objects
		},
	}
	cacheEntries.push(segment)

	_.each(ingestSegment.parts, (part) => {
		cacheEntries.push(generateCacheForPart(rundownId, segmentId, part))
	})

	return cacheEntries
}
function generateCacheForPart(
	rundownId: RundownId,
	segmentId: SegmentId,
	part: LocalIngestPart
): IngestDataCacheObjPart {
	const partId = getPartId(rundownId, part.externalId)
	return {
		_id: protectString<IngestDataCacheObjId>(`${rundownId}_${partId}`),
		type: IngestCacheType.PART,
		rundownId: rundownId,
		segmentId: segmentId,
		partId: partId,
		modified: part.modified,
		data: _.omit(part, 'modified'),
	}
}
