import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RunningOrderBaselineItem extends SegmentLineItemGeneric {
	segmentLineId: undefined
	trigger: {
		type: 0
		value: 0
	}
	disabled: false
	expectedDuration: 0
	transitions: undefined
	continuesRefId: undefined
	adLibSourceId: undefined
	dynamicallyInserted: undefined
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
