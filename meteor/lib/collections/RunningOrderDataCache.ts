import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'

export interface RunningOrderDataCacheObj {
	_id: string,
	modified: number,
	/** Id of the Running Order */
	roId: string,
	data: any
}

export const RunningOrderDataCache: TransformedCollection<RunningOrderDataCacheObj, RunningOrderDataCacheObj>
	= new Mongo.Collection<RunningOrderDataCacheObj>('runningorderdatacache')
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrderDataCache._ensureIndex({
			roId: 1
		})
	}
})
