import { Mongo } from 'meteor/mongo'
import { SegmentLineItemGeneric } from './SegmentLineItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { IBlueprintSegmentLineAdLibItem, BaseContent } from 'tv-automation-sofie-blueprints-integration'

export interface SegmentLineAdLibItem extends SegmentLineItemGeneric, IBlueprintSegmentLineAdLibItem {
	_rank: number

	expectedDuration: number | string

	/** The object describing the item in detail */
	content?: BaseContent // TODO: Temporary, should be put into IBlueprintSegmentLineAdLibItem

	trigger: undefined
	disabled: false

	/** When something bad has happened, we can mark the AdLib as invalid, which will prevent the user from TAKE:ing it */
	invalid?: boolean
}

export const SegmentLineAdLibItems: TransformedCollection<SegmentLineAdLibItem, SegmentLineAdLibItem>
	= new Mongo.Collection<SegmentLineAdLibItem>('segmentLineAdLibItems')
registerCollection('SegmentLineAdLibItems', SegmentLineAdLibItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		SegmentLineAdLibItems._ensureIndex({
			runningOrderId: 1,
			segmentLineId: 1,
			_rank: 1
		})
	}
})
