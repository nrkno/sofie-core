import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum SnapshotType {
	RUNNING_ORDER = 'runningorder',
	SYSTEM = 'system'
}
export interface Snapshot {
	type: SnapshotType,
	created: Time
	description?: string
}

export interface SnapshotRunningOrder extends Snapshot {
	type: SnapshotType.RUNNING_ORDER
	studioId: string,
	runningOrderId: string
}
export interface SnapshotSystem extends Snapshot {
	type: SnapshotType.SYSTEM
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
