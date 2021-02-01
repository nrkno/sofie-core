import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getCurrentTime, protectString, unprotectString } from '../../../lib/lib'
import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import {
	IngestDataCacheObj,
	IngestCacheType,
	IngestDataCacheObjPart,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
	IngestDataCacheObjId,
} from '../../../lib/collections/IngestDataCache'
import { getSegmentId, getPartId } from './lib'
import { logger } from '../../../lib/logging'
import { RundownId } from '../../../lib/collections/Rundowns'
import { SegmentId } from '../../../lib/collections/Segments'
import { PartId } from '../../../lib/collections/Parts'
import { DbCacheWriteCollection, saveIntoCache, DbCacheReadCollection } from '../../cache/lib'
import { profiler } from '../profiler'

export type RundownIngestDataCacheCollection = DbCacheWriteCollection<IngestDataCacheObj, IngestDataCacheObj>
export type ReadOnlyRundownIngestDataCacheCollection = DbCacheReadCollection<IngestDataCacheObj, IngestDataCacheObj>

/** TODO-CACHE the `_id`s used here are consistent and predictable, so this should be rewritten to operate more directly on the cache with the ids instead */

export function loadCachedRundownData(
	cache: ReadOnlyRundownIngestDataCacheCollection,
	rundownId: RundownId,
	rundownExternalId: string
): LocalIngestRundown {
	const span = profiler.startSpan('ingest.ingestCache.loadCachedRundownData')

	const cacheEntries = cache.findFetch({})

	const cachedRundown = cacheEntries.find((e) => e.type === IngestCacheType.RUNDOWN)
	if (!cachedRundown)
		throw new Meteor.Error(404, `Rundown "${rundownId}", (${rundownExternalId}) has no cached ingest data`)

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
export function loadCachedIngestSegment(
	cache: ReadOnlyRundownIngestDataCacheCollection,
	rundownExternalId: string,
	segmentId: SegmentId,
	segmentExternalId: string
): LocalIngestSegment {
	const cacheEntries = cache.findFetch({ segmentId: segmentId })

	const segmentEntries = cacheEntries.filter((e) => e.type === IngestCacheType.SEGMENT)
	if (segmentEntries.length > 1)
		logger.warn(
			`There are multiple segments (${cacheEntries.length}) in IngestDataCache for rundownId: "${rundownExternalId}", segmentId: "${segmentExternalId}"`
		)

	const segmentEntry = segmentEntries[0]
	if (!segmentEntry)
		throw new Meteor.Error(
			404,
			`Segment "${segmentExternalId}" in rundown "${rundownExternalId}" is missing cached ingest data`
		)
	if (segmentEntry.type !== IngestCacheType.SEGMENT) throw new Meteor.Error(500, 'Wrong type on cached segment')

	const ingestSegment = segmentEntry.data as LocalIngestSegment
	ingestSegment.modified = segmentEntry.modified

	_.each(cacheEntries, (entry) => {
		if (entry.type === IngestCacheType.PART) {
			const ingestPart = entry.data as LocalIngestPart
			ingestPart.modified = entry.modified

			ingestSegment.parts.push(ingestPart)
		}
	})

	ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

	return ingestSegment
}
export function loadIngestDataCachePart(
	cache: RundownIngestDataCacheCollection,
	rundownExternalId: string,
	partId: PartId,
	partExternalId: string
): IngestDataCacheObjPart {
	const cacheEntries = cache.findFetch({
		partId: partId,
		type: IngestCacheType.PART,
	})
	if (cacheEntries.length > 1)
		logger.warn(
			`There are multiple parts (${cacheEntries.length}) in IngestDataCache for rundownId: "${rundownExternalId}", partId: "${partExternalId}"`
		)

	const partEntry = cacheEntries[0]
	if (!partEntry)
		throw new Meteor.Error(
			404,
			`Part "${partExternalId}" in rundown "${rundownExternalId}" is missing cached ingest data`
		)
	if (partEntry.type !== IngestCacheType.PART) throw new Meteor.Error(500, 'Wrong type on cached part')
	return partEntry
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
export function saveSegmentCache(
	cache: RundownIngestDataCacheCollection,
	rundownId: RundownId,
	segmentId: SegmentId,
	ingestSegment: LocalIngestSegment
) {
	const span = profiler.startSpan('ingest.ingestCache.saveSegmentCache')

	// cache the Data:
	const cacheEntries: IngestDataCacheObj[] = generateCacheForSegment(rundownId, ingestSegment)
	saveIntoCache<IngestDataCacheObj, IngestDataCacheObj>(
		cache,
		{
			segmentId: segmentId,
		},
		cacheEntries
	)

	span?.end()
}
interface LocalIngestBase {
	modified: number
}
export interface LocalIngestRundown extends IngestRundown, LocalIngestBase {
	segments: LocalIngestSegment[]
}
export interface LocalIngestSegment extends IngestSegment, LocalIngestBase {
	parts: LocalIngestPart[]
}
export interface LocalIngestPart extends IngestPart, LocalIngestBase {}
export function isLocalIngestRundown(o: IngestRundown | LocalIngestRundown): o is LocalIngestRundown {
	return !!o['modified']
}
export function makeNewIngestRundown(ingestRundown: IngestRundown): LocalIngestRundown {
	return {
		...ingestRundown,
		segments: _.map(ingestRundown.segments, makeNewIngestSegment),
		modified: getCurrentTime(),
	}
}
export function makeNewIngestSegment(ingestSegment: IngestSegment): LocalIngestSegment {
	return {
		...ingestSegment,
		parts: _.map(ingestSegment.parts, makeNewIngestPart),
		modified: getCurrentTime(),
	}
}
export function makeNewIngestPart(ingestPart: IngestPart): LocalIngestPart {
	return { ...ingestPart, modified: getCurrentTime() }
}

export function updateIngestRundownWithData(
	oldIngestRundown: LocalIngestRundown,
	newIngestSegments: LocalIngestSegment[]
): LocalIngestRundown {
	const newIngestRundown = _.clone(oldIngestRundown) as LocalIngestRundown
	newIngestRundown.segments = newIngestSegments as LocalIngestSegment[]
	_.each(newIngestRundown.segments, (newIngestSegment) => {
		const oldIngestSegment = oldIngestRundown.segments.find((s) => s.externalId === newIngestSegment.externalId)
		if (oldIngestSegment) {
			newIngestSegment.modified = Math.max(newIngestSegment.modified, oldIngestSegment.modified)
		} else {
			newIngestSegment.modified = getCurrentTime()
		}
	})
	return newIngestRundown
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
