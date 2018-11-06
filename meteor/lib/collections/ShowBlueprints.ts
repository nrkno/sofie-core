import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface ShowBlueprint {
	_id: string
	showStyleId: string
	code: string
	modified: number
	version: string
}

export const ShowBlueprints: TransformedCollection<ShowBlueprint, ShowBlueprint>
	= new Mongo.Collection<ShowBlueprint>('showBlueprints')
registerCollection('ShowBlueprints', ShowBlueprints)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowBlueprints._ensureIndex({
			showStyleId: 1
		})
	}
})
