import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObjGeneric } from './Timeline'

export interface RundownBaselineObj {
	_id: string
	/** The rundown this timeline-object belongs to */
	rundownId: string

	objects: TimelineObjGeneric[]
}

export const RundownBaselineObjs: TransformedCollection<RundownBaselineObj, RundownBaselineObj>
	= new Mongo.Collection<RundownBaselineObj>('rundownBaselineObjs')
registerCollection('RundownBaselineObjs', RundownBaselineObjs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineObjs._ensureIndex({
			rundownId: 1
		})
	}
})
