import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'

export interface SegmentLineAdLibItem extends SegmentLineItemGeneric {
	_rank: number

	trigger: undefined
	disabled: false
}

export const SegmentLineAdLibItems: TransformedCollection<SegmentLineAdLibItem, SegmentLineAdLibItem>
	= new Mongo.Collection<SegmentLineAdLibItem>('segmentLineAdLibItems')
registerCollection('SegmentLineAdLibItems', SegmentLineAdLibItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLineAdLibItems._ensureIndex({
			runningOrderId: 1,
		})
	}
})
