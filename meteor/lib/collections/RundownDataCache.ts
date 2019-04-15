import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RundownDataCacheObj {
	_id: string,
	modified: number,
	/** Id of the Rundown */
	rundownId: string,
	data: any
}

export enum CachePrefix {
	INGEST_PART = 'fullStory',
	INGEST_RUNDOWN = 'rundownCreate',
	INGEST_SEGMENT = 'segment'
}

// TODO Deprecate?
export const RundownDataCache: TransformedCollection<RundownDataCacheObj, RundownDataCacheObj>
	= new Mongo.Collection<RundownDataCacheObj>('rundowndatacache')
registerCollection('RundownDataCache', RundownDataCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownDataCache._ensureIndex({
			rundownId: 1
		})
	}
})
