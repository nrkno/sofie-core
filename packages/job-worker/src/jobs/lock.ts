import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
