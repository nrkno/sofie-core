import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { SnapshotId } from '../collections/Snapshots'
import { StudioId } from '../collections/Studios'

export interface NewSnapshotAPI {
	storeSystemSnapshot(studioId: StudioId | null, reason: string): Promise<SnapshotId>
	storeRundownPlaylist(playlistId: RundownPlaylistId, reason: string): Promise<SnapshotId>
	storeDebugSnapshot(studioId: StudioId, reason: string): Promise<SnapshotId>
	restoreSnapshot(snapshotId: SnapshotId): Promise<void>
	removeSnapshot(snapshotId: SnapshotId): Promise<void>
}

export enum SnapshotAPIMethods {
	storeSystemSnapshot = 'snapshot.systemSnapshot',
	storeRundownPlaylist = 'snapshot.rundownPlaylistSnapshot',
	storeDebugSnapshot = 'snapshot.debugSnaphot',

	restoreSnapshot = 'snapshot.restoreSnaphot',
	removeSnapshot = 'snapshot.removeSnaphot',
}
