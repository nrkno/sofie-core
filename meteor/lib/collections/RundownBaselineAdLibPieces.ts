import { Mongo } from 'meteor/mongo'
import { AdLibPiece } from './AdLibPieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RundownBaselineAdLibItem extends AdLibPiece {
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
