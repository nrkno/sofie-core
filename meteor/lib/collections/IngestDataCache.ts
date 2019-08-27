import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

export interface IngestDataCacheObjBase {
	_id: string
	modified: number
	type: IngestCacheType

	/** Id of the Rundown */
	rundownId: string
	segmentId?: string
	partId?: string

	data: IngestCacheData
}

export interface IngestDataCacheObjRundown extends IngestDataCacheObjBase {
	type: IngestCacheType.RUNDOWN
	rundownId: string
	data: IngestRundown
}
export interface IngestDataCacheObjSegment extends IngestDataCacheObjBase {
	type: IngestCacheType.SEGMENT
	rundownId: string
	segmentId: string

	data: IngestSegment
}
export interface IngestDataCacheObjPart extends IngestDataCacheObjBase {
	type: IngestCacheType.PART
	rundownId: string
	segmentId: string
	partId: string
	data: IngestPart
}
export type IngestDataCacheObj = IngestDataCacheObjRundown | IngestDataCacheObjSegment | IngestDataCacheObjPart

export const IngestDataCache: TransformedCollection<IngestDataCacheObj, IngestDataCacheObj>
	= createMongoCollection<IngestDataCacheObj>('ingestDataCache')
registerCollection('IngestDataCache', IngestDataCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		IngestDataCache._ensureIndex({
			rundownId: 1
		})
	}
})
