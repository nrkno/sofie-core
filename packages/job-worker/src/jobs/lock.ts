import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export type DeferedLockFunction = () => Promise<void>

export interface LockBase {
	readonly isLocked: boolean

	release(): Promise<void>

	toString(): string

	/** Defer a function to run after the lock has been released */
	deferAfterRelease(fcn: DeferedLockFunction): void
}

export abstract class PlaylistLock implements LockBase {
	protected deferedFunctions: DeferedLockFunction[] = []

	protected constructor(public readonly playlistId: RundownPlaylistId) {}

	abstract get isLocked(): boolean

	abstract release(): Promise<void>

	toString(): string {
		return `PlaylistLock "${this.playlistId}" locked=${this.isLocked.toString()}`
	}

	deferAfterRelease(fcn: DeferedLockFunction): void {
		this.deferedFunctions.push(fcn)
	}
}

export abstract class RundownLock implements LockBase {
	protected deferedFunctions: DeferedLockFunction[] = []

	protected constructor(public readonly rundownId: RundownId) {}

	abstract get isLocked(): boolean

	abstract release(): Promise<void>

	toString(): string {
		return `RundownLock "${this.rundownId}" locked=${this.isLocked.toString()}`
	}

	deferAfterRelease(fcn: DeferedLockFunction): void {
		this.deferedFunctions.push(fcn)
	}
}
