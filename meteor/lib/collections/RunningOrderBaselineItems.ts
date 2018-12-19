import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { TimelineObj } from './Timeline'

export interface RunningOrderBaselineItem {
	_id: string
	/** The running order this item belongs to */
	runningOrderId: string

	objects: TimelineObj[]
}

export const RunningOrderBaselineItems: TransformedCollection<RunningOrderBaselineItem, RunningOrderBaselineItem>
	= new Mongo.Collection<RunningOrderBaselineItem>('runningOrderBaselineItems')
registerCollection('RunningOrderBaselineItems', RunningOrderBaselineItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrderBaselineItems._ensureIndex({
			runningOrderId: 1
		})
	}
})
