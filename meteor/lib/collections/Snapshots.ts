import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
import { createMongoCollection } from './lib'


export enum SnapshotType {
	RUNDOWN = 'rundown', // to be deprecated?
	RUNDOWNPLAYLIST = 'rundownplaylist',
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

export interface DeprecatedSnapshotRundown extends SnapshotBase { // From the times before rundownPlaylists
	type: SnapshotType.RUNDOWN
	studioId: string
	rundownId: string
}
export interface SnapshotRundownPlaylist extends SnapshotBase {
	type: SnapshotType.RUNDOWNPLAYLIST
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
	= createMongoCollection<SnapshotItem>('snapshots')
registerCollection('Snapshots', Snapshots)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Snapshots._ensureIndex({
			timestamp: 1
		})
	}
})
