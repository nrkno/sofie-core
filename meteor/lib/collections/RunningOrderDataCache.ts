import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'

export interface RunningOrderDataCacheObj {
	_id: string,
	modified: number,
	/** Id of the Running Order */
	roId: string,
	data: any
}

export enum CachePrefix {
	FULLSTORY = 'fullStory',
	ROCREATE = 'roCreate'
}

export const RunningOrderDataCache: TransformedCollection<RunningOrderDataCacheObj, RunningOrderDataCacheObj>
	= new Mongo.Collection<RunningOrderDataCacheObj>('runningorderdatacache')
registerCollection('RunningOrderDataCache', RunningOrderDataCache)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrderDataCache._ensureIndex({
			roId: 1
		})
	}
})
