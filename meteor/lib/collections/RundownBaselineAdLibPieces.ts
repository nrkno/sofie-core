import { Mongo } from 'meteor/mongo'
import { SegmentLineAdLibItem } from './SegmentLineAdLibItems'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RundownBaselineAdLibItem extends SegmentLineAdLibItem {
}

export const RundownBaselineAdLibItems: TransformedCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>
	= new Mongo.Collection<RundownBaselineAdLibItem>('rundownBaselineAdLibItems')
registerCollection('RundownBaselineAdLibItems', RundownBaselineAdLibItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineAdLibItems._ensureIndex({
			rundownId: 1
		})
	}
})
