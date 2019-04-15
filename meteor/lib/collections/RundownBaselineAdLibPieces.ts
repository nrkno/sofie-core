import { Mongo } from 'meteor/mongo'
import { SegmentLineAdLibItem } from './SegmentLineAdLibItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RunningOrderBaselineAdLibItem extends SegmentLineAdLibItem {
}

export const RunningOrderBaselineAdLibItems: TransformedCollection<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>
	= new Mongo.Collection<RunningOrderBaselineAdLibItem>('runningOrderBaselineAdLibItems')
registerCollection('RunningOrderBaselineAdLibItems', RunningOrderBaselineAdLibItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrderBaselineAdLibItems._ensureIndex({
			runningOrderId: 1
		})
	}
})
