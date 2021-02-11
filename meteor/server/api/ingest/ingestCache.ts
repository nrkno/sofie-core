import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { getCurrentTime, protectString, unprotectString, clone } from '../../../lib/lib'
import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import {
	IngestDataCacheObj,
	IngestDataCache,
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
import { profiler } from '../profiler'
import { ReadonlyDeep } from 'type-fest'

export function loadCachedRundownData(rundownId: RundownId, rundownExternalId: string): LocalIngestRundown {
	const span = profiler.startSpan('ingest.ingestCache.loadCachedRundownData')

	const cacheEntries = IngestDataCache.find({ rundownId: rundownId }).fetch()

	const cachedRundown = cacheEntries.find((e) => e.type === IngestCacheType.RUNDOWN)
	if (!cachedRundown) {
		span?.end()
		throw new Meteor.Error(404, `Rundown "${rundownId}", (${rundownExternalId}) has no cached ingest data`)
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

export function loadCachedIngestSegment(
	rundownId: RundownId,
	rundownExternalId: string,
	segmentId: SegmentId,
	segmentExternalId: string
): LocalIngestSegment {
	const cacheEntries = IngestDataCache.find({
		rundownId: rundownId,
		segmentId: segmentId,
	}).fetch()

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
