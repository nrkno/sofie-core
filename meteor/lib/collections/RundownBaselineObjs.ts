import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjGeneric } from './Timeline'

export interface RundownBaselineItem {
	_id: string
	/** The rundown this item belongs to */
	rundownId: string

	objects: TimelineObjGeneric[]
}

export const RundownBaselineObjs: TransformedCollection<RundownBaselineItem, RundownBaselineItem>
	= new Mongo.Collection<RundownBaselineItem>('rundownBaselineObjs')
registerCollection('RundownBaselineObjs', RundownBaselineObjs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineObjs._ensureIndex({
			rundownId: 1
		})
	}
})
