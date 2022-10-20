import { Time } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import {
	SnapshotId,
	StudioId,
	RundownId,
	RundownPlaylistId,
	OrganizationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export enum SnapshotType {
	RUNDOWNPLAYLIST = 'rundownplaylist',
	SYSTEM = 'system',
	DEBUG = 'debug',
}

export interface SnapshotBase {
	_id: SnapshotId
	/** If set, the organization the owns this Snapshot */
	organizationId: OrganizationId | null

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

	studioId?: StudioId
	rundownId?: RundownId
	playlistId?: RundownPlaylistId
}

export interface SnapshotRundownPlaylist extends SnapshotBase {
	type: SnapshotType.RUNDOWNPLAYLIST
	studioId: StudioId
	playlistId: RundownPlaylistId
}
export interface SnapshotSystem extends SnapshotBase {
	type: SnapshotType.SYSTEM
}
export interface SnapshotDebug extends SnapshotBase {
	type: SnapshotType.DEBUG
}

export const Snapshots = createMongoCollection<SnapshotItem>(CollectionName.Snapshots)

registerIndex(Snapshots, {
	organizationId: 1,
})
registerIndex(Snapshots, {
	created: 1,
})
