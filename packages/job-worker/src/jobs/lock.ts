import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '.'

export abstract class PlaylistLock {
	protected constructor(public readonly playlistId: RundownPlaylistId) {}

	abstract get isLocked(): boolean

	abstract release(): Promise<void>
}
class PlaylistLockImpl extends PlaylistLock {
	#isLocked = true

	public constructor(playlistId: RundownPlaylistId) {
		super(playlistId)
	}

	get isLocked(): boolean {
		return this.#isLocked
	}

	async release(): Promise<void> {
		// TODO - do something real here

		this.#isLocked = false
	}
}

export async function lockPlaylist(_context: JobContext, playlistId: RundownPlaylistId): Promise<PlaylistLock> {
	// TODO - do something real here
	// TODO - these should be tracked on the JobContext, so that at termination it can be forcefully freed
	return new PlaylistLockImpl(playlistId)
}
