import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../logging'
import { JobContext } from '.'

export interface LockBase {
	readonly isLocked: boolean

	release(): Promise<void>

	toString(): string
}

export abstract class PlaylistLock implements LockBase {
	protected constructor(public readonly playlistId: RundownPlaylistId) {}

	abstract get isLocked(): boolean

	abstract release(): Promise<void>

	toString(): string {
		return `PlaylistLock "${this.playlistId}" locked=${this.isLocked.toString()}`
	}
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
		logger.info(`PlaylistLock: Releasing "${this.playlistId}"`)
		// TODO - do something real here

		this.#isLocked = false

		logger.info(`PlaylistLock: Released "${this.playlistId}"`)
	}
}

export async function lockPlaylist(_context: JobContext, playlistId: RundownPlaylistId): Promise<PlaylistLock> {
	logger.info(`PlaylistLock: Locking "${playlistId}"`)

	// TODO - do something real here
	// TODO - these should be tracked on the JobContext, so that at termination it can be forcefully freed

	logger.info(`PlaylistLock: Locked "${playlistId}"`)
	return new PlaylistLockImpl(playlistId)
}
