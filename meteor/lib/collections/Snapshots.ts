import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface Snapshot {
	studioId: string,
	runningOrderId: string
}

export const Snapshots: TransformedCollection<Snapshot, Snapshot>
	= new Mongo.Collection<Snapshot>('snapshots')
registerCollection('Snapshots', Snapshots)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Snapshots._ensureIndex({
			timestamp: 1
		})
	}
})
