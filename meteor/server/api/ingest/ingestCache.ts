import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { saveIntoDb, getCurrentTime } from '../../../lib/lib'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCacheObj, IngestDataCache, IngestCacheType } from '../../../lib/collections/IngestDataCache'
import { getSegmentId, getPartId } from './lib'

export function loadCachedRundownData (rundownId: string): IngestRundown {
	const cacheEntries = IngestDataCache.find({ rundownId: rundownId }).fetch()

	const baseEntry = cacheEntries.find(e => e.type === IngestCacheType.RUNDOWN)
	if (!baseEntry) throw new Meteor.Error(500, 'Failed to find cached rundown')

	const ingestRundown = baseEntry.data as IngestRundown

	const segmentMap = _.groupBy(cacheEntries, e => e.segmentId)
	_.each(segmentMap, objs => {
		const segmentEntry = objs.find(e => e.type === IngestCacheType.SEGMENT)
		if (segmentEntry) {
			const ingestSegment = segmentEntry.data as IngestSegment
			_.each(objs, e => {
				if (e.type === IngestCacheType.PART) {
					ingestSegment.parts.push(e.data)
				}
			})
			ingestRundown.segments.push(ingestSegment)
		}
	})

	return ingestRundown
}

export function loadCachedIngestSegment (rundownId: string, segmentId: string): IngestSegment {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		segmentId: segmentId,
	}).fetch()

	const segmentEntry = cacheEntries.find(e => e.type === IngestCacheType.SEGMENT)
	if (!segmentEntry) throw new Meteor.Error(500, 'Failed to find cached segment')

	const ingestSegment = segmentEntry.data as IngestSegment

	_.each(cacheEntries, e => {
		if (e.type === IngestCacheType.PART) {
			ingestSegment.parts.push(e.data)
		}
	})

	return ingestSegment
}
export function loadCachedPartData (rundownId: string, segmentId: string, partId: string): IngestPart {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		segmentId: segmentId,
		partId: partId,
		type: IngestCacheType.PART
	}).fetch()

	const partEntry = cacheEntries.find(e => e.type === IngestCacheType.SEGMENT)
	if (!partEntry) throw new Meteor.Error(500, 'Failed to find cached part')

	return partEntry.data as IngestSegment
}

export function saveRundownCache (rundownId: string, ingestRundown: IngestRundown) {
	// cache the Data:
	const cacheEntries: IngestDataCacheObj[] = generateCacheForRundown(rundownId, ingestRundown)
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		rundownId: rundownId,
	}, cacheEntries)
}
export function saveSegmentCache (rundownId: string, segmentId: string, ingestSegment: IngestSegment) {
	// cache the Data:
	const cacheEntries: IngestDataCacheObj[] = generateCacheForSegment(rundownId, ingestSegment)
	saveIntoDb<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache, {
		rundownId: rundownId,
		segmentId: segmentId,
	}, cacheEntries)
}

function generateCacheForRundown (rundownId: string, ingestRundown: IngestRundown): IngestDataCacheObj[] {
	// cache the Data
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: rundownId,
		type: IngestCacheType.RUNDOWN,
		rundownId: rundownId,
		modified: getCurrentTime(),
		data: {
			...ingestRundown,
			segments: [] // omit the segments
		}
	})
	_.each(ingestRundown.segments, segment => cacheEntries.push(...generateCacheForSegment(rundownId, segment)))
	return cacheEntries
}
function generateCacheForSegment (rundownId: string, ingestSegment: IngestSegment): IngestDataCacheObj[] {
	const segmentExternalId = getSegmentId(rundownId, ingestSegment.externalId)
	const cacheEntries: IngestDataCacheObj[] = []
	cacheEntries.push({
		_id: `${rundownId}_${segmentExternalId}`,
		type: IngestCacheType.SEGMENT,
		rundownId: rundownId,
		segmentId: segmentExternalId,
		modified: getCurrentTime(),
		data: {
			...ingestSegment,
			parts: []
		}
	})

	_.each(ingestSegment.parts, part => {
		const partId = getPartId(rundownId, part.externalId)
		cacheEntries.push(generateCacheForPart(rundownId, segmentExternalId, part))
	})

	return cacheEntries
}
function generateCacheForPart (rundownId: string, segmentExternalId: string, part: IngestPart): IngestDataCacheObj {
	const partId = getPartId(rundownId, part.externalId)
	return {
		_id: `${rundownId}_${partId}`,
		type: IngestCacheType.PART,
		rundownId: rundownId,
		segmentId: segmentExternalId,
		partId: partId,
		modified: getCurrentTime(),
		data: part
	}
}
