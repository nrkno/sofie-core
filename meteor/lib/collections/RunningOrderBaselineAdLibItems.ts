import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'

export interface RunningOrderBaselineAdLibItem extends SegmentLineItemGeneric {
	trigger: undefined
	disabled: false
}

export const RunningOrderBaselineAdLibItems: TransformedCollection<RunningOrderBaselineAdLibItem, RunningOrderBaselineAdLibItem>
	= new Mongo.Collection<RunningOrderBaselineAdLibItem>('runningOrderBaselineAdLibItems')

Meteor.startup(() => {
	if (Meteor.isServer) {
		RunningOrderBaselineAdLibItems._ensureIndex({
			runningOrderId: 1
		})
	}
})
