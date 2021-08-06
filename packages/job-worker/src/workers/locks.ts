import { Subject } from 'threads/observable'
import { createManualPromise, ManualPromise } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'

export type AnyLockEvent = LockEvent | UnLockEvent
export interface LockEvent {
	event: 'lock'
	resourceId: string
	lockId: string
}
export interface UnLockEvent {
	event: 'unlock'
	resourceId: string
	lockId: string
}

export class LocksManager {
	readonly lockEvents: Subject<AnyLockEvent>
	/** These are locks that we are waiting to aquire/release */
	readonly pendingLocks: Map<string, ManualPromise<boolean>>

	constructor() {
		this.lockEvents = new Subject<AnyLockEvent>()
		this.pendingLocks = new Map()
	}

	changeEvent(lockId: string, locked: boolean): void {
		// defer to not block the call in the parent
		setImmediate(() => {
			try {
				const lock = this.pendingLocks.get(lockId)
				if (!lock) throw new Error('Lock not waiting!')

				// Pass on the result for processing
				lock.manualResolve(locked)
			} catch (e) {
				logger.error(`LockChange "${lockId}":${locked} failed: ${e}`)
			}
		})
	}

	async aquire(lockId: string, resourceId: string): Promise<void> {
		// TODO - this should handle timeouts

		if (this.pendingLocks.has(lockId)) throw new Error(`Lock "${lockId}" is already pending`)

		const completedPromise = createManualPromise<boolean>()
		this.pendingLocks.set(lockId, completedPromise)

		// inform parent
		this.lockEvents.next({
			event: 'lock',
			lockId,
			resourceId,
		})

		return completedPromise.then((locked) => {
			this.pendingLocks.delete(lockId)

			if (!locked) throw new Error(`Lock "${lockId}" wanted lock but got unlock!`)
		})
	}

	async release(lockId: string, resourceId: string): Promise<void> {
		// TODO - this should handle timeouts

		if (this.pendingLocks.has(lockId)) throw new Error(`Lock "${lockId}" is already pending`)

		const completedPromise = createManualPromise<boolean>()
		this.pendingLocks.set(lockId, completedPromise)

		// inform parent
		this.lockEvents.next({
			event: 'unlock',
			lockId,
			resourceId,
		})

		return completedPromise.then((locked) => {
			this.pendingLocks.delete(lockId)

			if (locked) throw new Error(`Lock "${lockId}" wanted unlock but got lock!`)
		})
	}
}
