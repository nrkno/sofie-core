import { Meteor } from 'meteor/meteor'
import { IngestPart, IngestRundown, IngestSegment } from 'tv-automation-sofie-blueprints-integration'
import { ProtectedString, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { PartId } from './Parts'
import { RundownId } from './Rundowns'
import { SegmentId } from './Segments'

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

/** A string, identifying a IngestDataCacheObj */
export type IngestDataCacheObjId = ProtectedString<'IngestDataCacheObjId'>

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

export const IngestDataCache: TransformedCollection<IngestDataCacheObj, IngestDataCacheObj> = createMongoCollection<
	IngestDataCacheObj
>('ingestDataCache')
registerCollection('IngestDataCache', IngestDataCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		IngestDataCache._ensureIndex({
			rundownId: 1,
		})
	}
})
