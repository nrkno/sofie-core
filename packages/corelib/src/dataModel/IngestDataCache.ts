import { IngestRundown, IngestSegment, IngestPart } from '@sofie-automation/blueprints-integration'
import { IngestDataCacheObjId, RundownId, SegmentId, PartId } from './Ids'

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

export interface IngestDataCacheObjBase {
	_id: IngestDataCacheObjId
	modified: number
	type: IngestCacheType

	/** Id of the Rundown */
	rundownId: RundownId
	segmentId?: SegmentId
	partId?: PartId

	data: IngestCacheData
}

export interface IngestDataCacheObjRundown extends IngestDataCacheObjBase {
	type: IngestCacheType.RUNDOWN
	rundownId: RundownId
	data: IngestRundown
}
export interface IngestDataCacheObjSegment extends IngestDataCacheObjBase {
	type: IngestCacheType.SEGMENT
	rundownId: RundownId
	segmentId: SegmentId

	data: IngestSegment
}
export interface IngestDataCacheObjPart extends IngestDataCacheObjBase {
	type: IngestCacheType.PART
	rundownId: RundownId
	segmentId: SegmentId
	partId: PartId
	data: IngestPart
}
export type IngestDataCacheObj = IngestDataCacheObjRundown | IngestDataCacheObjSegment | IngestDataCacheObjPart
