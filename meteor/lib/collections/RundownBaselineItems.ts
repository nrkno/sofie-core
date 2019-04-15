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

export const RundownBaselineItems: TransformedCollection<RundownBaselineItem, RundownBaselineItem>
	= new Mongo.Collection<RundownBaselineItem>('rundownBaselineItems')
registerCollection('RundownBaselineItems', RundownBaselineItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineItems._ensureIndex({
			rundownId: 1
		})
	}
})
