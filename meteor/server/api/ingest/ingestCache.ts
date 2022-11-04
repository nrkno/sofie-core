import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { IngestDataCache, IngestCacheType, IngestDataCacheObj } from '../../../lib/collections/IngestDataCache'
import { logger } from '../../../lib/logging'
import { profiler } from '../profiler'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'

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

export class RundownIngestDataCache {
	private constructor(private readonly rundownId: RundownId, private readonly documents: IngestDataCacheObj[]) {}

	static async create(rundownId: RundownId): Promise<RundownIngestDataCache> {
		const docs = await IngestDataCache.findFetchAsync({ rundownId })

		return new RundownIngestDataCache(rundownId, docs)
	}

	fetchRundown(): LocalIngestRundown | undefined {
		const span = profiler.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find((e) => e.type === IngestCacheType.RUNDOWN)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown = cachedRundown.data as LocalIngestRundown
		ingestRundown.modified = cachedRundown.modified

		const segmentMap = groupByToMap(this.documents, 'segmentId')
		for (const objs of segmentMap.values()) {
			const segmentEntry = objs.find((e) => e.type === IngestCacheType.SEGMENT)
			if (segmentEntry) {
				const ingestSegment = segmentEntry.data as LocalIngestSegment
				ingestSegment.modified = segmentEntry.modified

				for (const entry of objs) {
					if (entry.type === IngestCacheType.PART) {
						const ingestPart = entry.data as LocalIngestPart
						ingestPart.modified = entry.modified

						ingestSegment.parts.push(ingestPart)
					}
				}

				ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)
				ingestRundown.segments.push(ingestSegment)
			}
		}

		ingestRundown.segments = _.sortBy(ingestRundown.segments, (s) => s.rank)

		span?.end()
		return ingestRundown
	}

	fetchSegment(segmentId: SegmentId): LocalIngestSegment | undefined {
		const cacheEntries = this.documents.filter((d) => d.segmentId && d.segmentId === segmentId)

		const segmentEntries = cacheEntries.filter((e) => e.type === IngestCacheType.SEGMENT)
		if (segmentEntries.length > 1)
			logger.warn(
				`There are multiple segments (${cacheEntries.length}) in IngestDataCache for rundownId: "${this.rundownId}", segmentId: "${segmentId}"`
			)

		const segmentEntry = segmentEntries[0]
		if (!segmentEntry) return undefined
		if (segmentEntry.type !== IngestCacheType.SEGMENT) throw new Meteor.Error(500, 'Wrong type on cached segment')

		const ingestSegment = segmentEntry.data as LocalIngestSegment
		ingestSegment.modified = segmentEntry.modified

		for (const entry of cacheEntries) {
			if (entry.type === IngestCacheType.PART) {
				const ingestPart = entry.data as LocalIngestPart
				ingestPart.modified = entry.modified

				ingestSegment.parts.push(ingestPart)
			}
		}

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

		return ingestSegment
	}
}
