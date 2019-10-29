import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { saveIntoDb, getCurrentTime } from '../../../lib/lib'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { IngestDataCacheObj, IngestDataCache, IngestCacheType, IngestDataCacheObjPart, IngestDataCacheObjRundown, IngestDataCacheObjSegment } from '../../../lib/collections/IngestDataCache'
import { getSegmentId, getPartId } from './lib'
import { logger } from '../../../lib/logging'

export function loadCachedRundownData (rundownId: string, rundownExternalId: string): IngestRundown {
	const cacheEntries = IngestDataCache.find({ rundownId: rundownId }).fetch()

	const baseEntry = cacheEntries.find(e => e.type === IngestCacheType.RUNDOWN)
	if (!baseEntry) throw new Meteor.Error(404, `Rundown "${rundownId}", (${rundownExternalId}) has no cached ingest data`)

	const ingestRundown = baseEntry.data as IngestRundown

	const segmentMap = _.groupBy(cacheEntries, e => e.segmentId)
	_.each(segmentMap, objs => {
		const segmentEntry = objs.find(e => e.type === IngestCacheType.SEGMENT)
		if (segmentEntry) {
			const ingestSegment = segmentEntry.data as IngestSegment
			_.each(objs, e => {
				if (e.type === IngestCacheType.PART) {
					ingestSegment.parts.push(e.data as IngestSegment)
				}
			})

			ingestSegment.parts = _.sortBy(ingestSegment.parts, s => s.rank)
			ingestRundown.segments.push(ingestSegment)
		}
	})

	ingestRundown.segments = _.sortBy(ingestRundown.segments, s => s.rank)

	return ingestRundown
}
export function loadCachedIngestSegment (rundownId: string, rundownExternalId: string, segmentId: string, segmentExternalId: string): IngestSegment {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		segmentId: segmentId,
	}).fetch()

	const segmentEntries = cacheEntries.filter(e => e.type === IngestCacheType.SEGMENT)
	if (segmentEntries.length > 1) logger.warn(`There are multiple segments (${cacheEntries.length}) in IngestDataCache for rundownId: "${rundownExternalId}", segmentId: "${segmentExternalId}"`)

	const segmentEntry = segmentEntries[0]
	if (!segmentEntry) throw new Meteor.Error(404, `Segment "${segmentExternalId}" in rundown "${rundownExternalId}" is missing cached ingest data`)
	if (segmentEntry.type !== IngestCacheType.SEGMENT) throw new Meteor.Error(500, 'Wrong type on cached segment')

	const ingestSegment: IngestSegment = segmentEntry.data

	_.each(cacheEntries, entry => {
		if (entry.type === IngestCacheType.PART) {
			ingestSegment.parts.push(entry.data)
		}
	})

	ingestSegment.parts = _.sortBy(ingestSegment.parts, s => s.rank)

	return ingestSegment
}
export function loadIngestDataCachePart (rundownId: string, rundownExternalId: string, partId: string, partExternalId: string): IngestDataCacheObjPart {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		partId: partId,
		type: IngestCacheType.PART
	}).fetch()
	if (cacheEntries.length > 1) logger.warn(`There are multiple parts (${cacheEntries.length}) in IngestDataCache for rundownId: "${rundownExternalId}", partId: "${partExternalId}"`)

	const partEntry = cacheEntries[0]
	if (!partEntry) throw new Meteor.Error(404, `Part "${partExternalId}" in rundown "${rundownExternalId}" is missing cached ingest data`)
	if (partEntry.type !== IngestCacheType.PART) throw new Meteor.Error(500, 'Wrong type on cached part')
	return partEntry
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
	const rundown: IngestDataCacheObjRundown = {
		_id: rundownId,
		type: IngestCacheType.RUNDOWN,
		rundownId: rundownId,
		modified: getCurrentTime(),
		data: {
			...ingestRundown,
			segments: [] // omit the segments, they come as separate objects
		}
	}
	cacheEntries.push(rundown)
	_.each(ingestRundown.segments, segment => cacheEntries.push(...generateCacheForSegment(rundownId, segment)))
	return cacheEntries
}
function generateCacheForSegment (rundownId: string, ingestSegment: IngestSegment): IngestDataCacheObj[] {
	const segmentExternalId = getSegmentId(rundownId, ingestSegment.externalId)
	const cacheEntries: Array<IngestDataCacheObjSegment | IngestDataCacheObjPart> = []

	const segment: IngestDataCacheObjSegment = {
		_id: `${rundownId}_${segmentExternalId}`,
		type: IngestCacheType.SEGMENT,
		rundownId: rundownId,
		segmentId: segmentExternalId,
		modified: getCurrentTime(),
		data: {
			...ingestSegment,
			parts: []  // omit the parts, they come as separate objects
		}
	}
	cacheEntries.push(segment)

	_.each(ingestSegment.parts, part => {
		cacheEntries.push(generateCacheForPart(rundownId, segmentExternalId, part))
	})

	return cacheEntries
}
function generateCacheForPart (rundownId: string, segmentExternalId: string, part: IngestPart): IngestDataCacheObjPart {
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
