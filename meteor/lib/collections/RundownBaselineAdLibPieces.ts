import { Mongo } from 'meteor/mongo'
import { AdLibPiece } from './AdLibPieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface RundownBaselineAdLibItem extends AdLibPiece {
}

export const RundownBaselineAdLibPieces: TransformedCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>
	= new Mongo.Collection<RundownBaselineAdLibItem>('rundownBaselineAdLibPieces')
registerCollection('RundownBaselineAdLibPieces', RundownBaselineAdLibPieces)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineAdLibPieces._ensureIndex({
			rundownId: 1
		})
	}
})
