import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export enum SnapshotType {
	RUNDOWN = 'rundown',
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

	studioId?: string
	rundownId?: string
}

export interface SnapshotRundown extends SnapshotBase {
	type: SnapshotType.RUNDOWN
	studioId: string
	playlistId: string
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
