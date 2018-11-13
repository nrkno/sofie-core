import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum SnapshotType {
	RUNNING_ORDER = 'runningorder',
	SYSTEM = 'system',
	DEBUG = 'debug'
}

export interface SnapshotBase {
	_id: string
	type: SnapshotType
	created: Time
	name: string
	description?: string
	/** Version of the system that took the snapshot */
	version: string
}

export interface SnapshotItem extends SnapshotBase {
	fileName: string
	comment: string
}

export interface SnapshotRunningOrder extends SnapshotBase {
	type: SnapshotType.RUNNING_ORDER
	studioId: string
	runningOrderId: string
}
export interface SnapshotSystem extends SnapshotBase {
	type: SnapshotType.SYSTEM
}
export interface SnapshotDebug extends SnapshotBase {
	type: SnapshotType.DEBUG
}

export const Snapshots: TransformedCollection<SnapshotItem, SnapshotItem>
	= new Mongo.Collection<SnapshotItem>('snapshots')
registerCollection('Snapshots', Snapshots)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Snapshots._ensureIndex({
			timestamp: 1
		})
	}
})
