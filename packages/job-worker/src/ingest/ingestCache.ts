import { RundownId, SegmentId, IngestDataCacheObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IngestDataCacheObj,
	IngestCacheType,
	IngestDataCacheObjRundown,
	IngestDataCacheObjSegment,
	IngestDataCacheObjPart,
} from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../lib'
import _ = require('underscore')
import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { getPartId, getSegmentId } from './lib'
import { SetOptional } from 'type-fest'
import { groupByToMap, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'
import { diffAndReturnLatestObjects } from './model/implementation/utils'

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
	return 'modified' in o
}
export function makeNewIngestRundown(ingestRundown: SetOptional<IngestRundown, 'segments'>): LocalIngestRundown {
	return {
		...ingestRundown,
		segments: ingestRundown.segments ? _.map(ingestRundown.segments, makeNewIngestSegment) : [],
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

export class RundownIngestDataCache {
	readonly #changedDocumentIds = new Set<IngestDataCacheObjId>()

	private constructor(
		private readonly context: JobContext,
		private readonly rundownId: RundownId,
		private documents: IngestDataCacheObj[]
	) {}

	static async create(context: JobContext, rundownId: RundownId): Promise<RundownIngestDataCache> {
		const docs = await context.directCollections.IngestDataCache.findFetch({ rundownId })

		return new RundownIngestDataCache(context, rundownId, docs)
	}

	fetchRundown(): LocalIngestRundown | undefined {
		const span = this.context.startSpan('ingest.ingestCache.loadCachedRundownData')

		const cachedRundown = this.documents.find((e) => e.type === IngestCacheType.RUNDOWN)
		if (!cachedRundown) {
			span?.end()
			return undefined
		}

		const ingestRundown = cachedRundown.data as LocalIngestRundown
		ingestRundown.modified = cachedRundown.modified

		const hasSegmentId = (obj: IngestDataCacheObj): obj is IngestDataCacheObjSegment | IngestDataCacheObjPart => {
			return !!obj.segmentId
		}

		const segmentMap = groupByToMap(this.documents.filter(hasSegmentId), 'segmentId')
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

	update(ingestRundown: LocalIngestRundown): void {
		const cacheEntries: IngestDataCacheObj[] = generateCacheForRundown(this.rundownId, ingestRundown)

		this.documents = diffAndReturnLatestObjects(this.#changedDocumentIds, this.documents, cacheEntries)
	}

	delete(): void {
		// Mark each document for deletion
		for (const doc of this.documents) {
			this.#changedDocumentIds.add(doc._id)
		}

		this.documents = []
	}

	async saveToDatabase(): Promise<void> {
		const documentsMap = normalizeArrayToMap(this.documents, '_id')

		const updates: AnyBulkWriteOperation<IngestDataCacheObj>[] = []
		const removedIds: IngestDataCacheObjId[] = []
		for (const changedId of this.#changedDocumentIds) {
			const newDoc = documentsMap.get(changedId)
			if (!newDoc) {
				removedIds.push(changedId)
			} else {
				updates.push({
					replaceOne: {
						filter: {
							_id: changedId,
						},
						replacement: newDoc,
						upsert: true,
					},
				})
			}
		}

		if (removedIds.length) {
			updates.push({
				deleteMany: {
					filter: {
						_id: { $in: removedIds as any },
					},
				},
			})
		}

		await this.context.directCollections.IngestDataCache.bulkWrite(updates)
	}
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

	for (const segment of ingestRundown.segments) {
		cacheEntries.push(...generateCacheForSegment(rundownId, segment))
	}

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

	for (const part of ingestSegment.parts) {
		cacheEntries.push(generateCacheForPart(rundownId, segmentId, part))
	}

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
