import { assertNever, getRandomString } from '@sofie-automation/corelib/dist/lib'
import type { Subscription } from 'observable-fns'
import { logger } from './logging'
import { AnyLockEvent } from './workers/locks'
import { WorkerParentBase } from './workers/parent-base'

type OwnerAndLockIds = [string, string]

class LockResource {
	holder: OwnerAndLockIds | null = null
	waitingWorkers: Array<OwnerAndLockIds> = []

	constructor(readonly id: string) {}
}

export class LocksManager {
	readonly #resources = new Map<string, LockResource>()
	readonly #ids = new Map<string, WorkerParentBase>()
	readonly #subs = new Map<string, Subscription<AnyLockEvent>>()

	private getResource(resourceId: string): LockResource {
		let resource = this.#resources.get(resourceId)
		if (!resource) {
			resource = new LockResource(resourceId)
			this.#resources.set(resourceId, resource)
		}
		return resource
	}

	private lockNextWorker(resource: LockResource): void {
		if (resource.holder === null) {
			const nextWorker = resource.waitingWorkers.shift()
			if (nextWorker) {
				const worker = this.#ids.get(nextWorker[0])
				if (!worker) {
					// Worker was invalid, try next
					this.lockNextWorker(resource)
					return
				}

				resource.holder = nextWorker

				worker.workerLockChange(nextWorker[1], true).catch((e) => {
					logger.error(`Failed to report lock to worker: ${e}`)
					if (
						resource.holder &&
						resource.holder[0] === nextWorker[0] &&
						resource.holder[1] === nextWorker[1]
					) {
						// free it as the aquire was 'rejected'
						resource.holder = null
						this.lockNextWorker(resource)
					}
				})
			}
		}
	}

	async subscribe(worker: WorkerParentBase): Promise<void> {
		const id = getRandomString()
		this.#ids.set(id, worker)

		const events = worker.workerLockEvents()
		const sub = events.subscribe((e) => {
			const resource = this.getResource(e.resourceId)

			switch (e.event) {
				case 'lock':
					resource.waitingWorkers.push([id, e.lockId])

					// Check if we can lock it
					this.lockNextWorker(resource)

					break
				case 'unlock':
					if (resource.holder && resource.holder[0] === id && resource.holder[1] === e.lockId) {
						resource.holder = null

						worker.workerLockChange(e.lockId, false).catch((e) => {
							logger.error(`Failed to report lock to worker: ${e}`)
						})
					} else {
						logger.warn(`Worker tried to unlock a lock it doesnt own`)
					}

					this.lockNextWorker(resource)
					break
				default:
					assertNever(e)
					break
			}
		})
		this.#subs.set(id, sub)
	}

	/** Unsubscribe a worker from the lock channels */
	async unsubscribe(worker: WorkerParentBase): Promise<void> {
		const idPair = Array.from(this.#ids.entries()).find((w) => w[1] === worker)
		if (idPair) {
			const id = idPair[0]
			this.#ids.delete(id)

			// stop listening
			const sub = this.#subs.get(id)
			if (sub) sub.unsubscribe()

			// ensure all locks are freed
			for (const resource of this.#resources.values()) {
				if (resource.waitingWorkers.length > 0) {
					// Remove this worker from any waiting orders
					resource.waitingWorkers = resource.waitingWorkers.filter((r) => r[0] !== id)
				}

				if (resource.holder && resource.holder[0] === id) {
					// Remove this worker from any held locks
					resource.holder = null
					this.lockNextWorker(resource)
				}
			}
		}
	}
}
