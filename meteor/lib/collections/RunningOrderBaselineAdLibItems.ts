import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'

export interface RunningOrderBaselineAdLibItem extends SegmentLineItemGeneric {
	_rank: number

	trigger: undefined
	disabled: false
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
