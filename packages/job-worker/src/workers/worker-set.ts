import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoClient } from 'mongodb'
import { LocksManager } from '../locks'
import { IngestWorkerParent } from './ingest/parent'
import { StudioWorkerParent } from './studio/parent'
import { EventsWorkerParent } from './events/parent'
import { JobManager } from '../manager'
import { FastTrackTimelineFunc } from '../main'
import { WorkerParentBase } from './parent-base'

export class StudioWorkerSet {
	readonly #threads: WorkerParentBase[]
	readonly #locksManager: LocksManager

	constructor() {
		this.#threads = []
		this.#locksManager = new LocksManager(async (threadId, lockId, locked) => {
			// Check each thread in turn, to find the one that should be informed
			for (const thread of this.#threads) {
				if (thread.threadId === threadId) {
					await thread.workerLockChange(lockId, locked)
					return true
				}
			}

			// Unhandled lock event
			return false
		})
	}

	public static async create(
		workerId: string,
		mongoUri: string,
		dbName: string,
		mongoClient: MongoClient,
		studioId: StudioId,
		jobManager: JobManager,
		fastTrackTimeline: FastTrackTimelineFunc | null
	): Promise<StudioWorkerSet> {
		const result = new StudioWorkerSet()

		let failed = 0
		const ps: Array<Promise<void>> = []

		const tryAddThread = (thread: Promise<WorkerParentBase>): void => {
			ps.push(
				thread.then(
					(th) => {
						result.#threads.push(th)
					},
					() => {
						failed++
					}
				)
			)
		}

		tryAddThread(
			StudioWorkerParent.start(
				workerId,
				mongoUri,
				dbName,
				mongoClient,
				result.#locksManager,
				studioId,
				jobManager,
				fastTrackTimeline
			)
		)

		tryAddThread(
			EventsWorkerParent.start(
				workerId,
				mongoUri,
				dbName,
				mongoClient,
				result.#locksManager,
				studioId,
				jobManager,
				fastTrackTimeline
			)
		)

		tryAddThread(
			IngestWorkerParent.start(
				workerId,
				mongoUri,
				dbName,
				mongoClient,
				result.#locksManager,
				studioId,
				jobManager,
				fastTrackTimeline
			)
		)

		await Promise.allSettled(ps)

		if (failed > 0) {
			// terminate all the successful threads
			await result.terminate()
			throw new Error(`Failed to initialise ${failed} threads`)
		}

		return result
	}

	public async terminate(): Promise<void> {
		await Promise.allSettled(this.#threads.map((t) => t.terminate()))
	}
}
