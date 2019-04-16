import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration';

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}
export type IngestCacheData = IngestRundown | IngestSegment | IngestPart

export interface IngestDataCacheObj {
	_id: string,
	modified: number,
	type: IngestCacheType,

	/** Id of the Rundown */
	rundownId: string,
	segmentId?: string,
	partId?: string,

	data: IngestCacheData
}

export const IngestDataCache: TransformedCollection<IngestDataCacheObj, IngestDataCacheObj>
	= new Mongo.Collection<IngestDataCacheObj>('ingestDataCache')
registerCollection('IngestDataCache', IngestDataCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		IngestDataCache._ensureIndex({
			rundownId: 1
		})
	}
})
