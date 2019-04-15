import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum IngestCacheType {
	RUNDOWN = 'rundown',
	SEGMENT = 'segment',
	PART = 'part',
}

export interface IngestDataCacheObj {
	_id: string,
	modified: number,
	type: IngestCacheType,

	/** Id of the Rundown */
	rundownId: string,
	segmentId?: string,
	partId?: string,

	data: any
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
