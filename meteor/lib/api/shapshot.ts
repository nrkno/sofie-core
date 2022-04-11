import { StudioId } from '../collections/Studios'
import { SnapshotId } from '../collections/Snapshots'
import { RundownPlaylistId } from '../collections/RundownPlaylists'

export interface NewSnapshotAPI {
	storeSystemSnapshot(studioId: StudioId | null, reason: string): Promise<SnapshotId>
	storeRundownPlaylist(playlistId: RundownPlaylistId, reason: string, full?: boolean): Promise<SnapshotId>
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
