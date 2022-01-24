import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { EventsWorkerChild } from './child'
import { MongoClient } from 'mongodb'
import { InvalidateWorkerDataCache } from '../caches'
import { LocksManager } from '../../locks'
import { WorkerParentBase } from '../parent-base'
import { AnyLockEvent } from '../locks'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { Promisify, threadedClass, ThreadedClassManager } from 'threadedclass'
import { JobManager } from '../../manager'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main'
import { addThreadNameToLogLine } from '../../logging'

export class EventsWorkerParent extends WorkerParentBase {
	readonly #thread: Promisify<EventsWorkerChild>

	private constructor(
		workerId: string,
		threadId: string,
		studioId: StudioId,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		queueName: string,
		jobManager: JobManager,
		thread: Promisify<EventsWorkerChild>
	) {
		super(workerId, threadId, studioId, mongoClient, locksManager, queueName, jobManager)

		this.#thread = thread
	}

	static async start(
		workerId: string,
		mongoUri: string,
		mongoDb: string,
		mongoClient: MongoClient,
		locksManager: LocksManager,
		studioId: StudioId,
		jobManager: JobManager,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null
	): Promise<EventsWorkerParent> {
		const threadId = getRandomString()
		const emitLockEvent = (e: AnyLockEvent) => locksManager.handleLockEvent(threadId, e)
		const logLineInner = (msg: unknown) => logLine(addThreadNameToLogLine(getEventsQueueName(studioId), msg))

		const workerThread = await threadedClass<EventsWorkerChild, typeof EventsWorkerChild>(
			'./child',
			'EventsWorkerChild',
			[emitLockEvent, jobManager.queueJob, logLineInner, fastTrackTimeline],
			{
				instanceName: `Events: ${studioId}`,
			}
		)

		// create and start the worker
		const parent = new EventsWorkerParent(
			workerId,
			threadId,
			studioId,
			mongoClient,
			locksManager,
			getEventsQueueName(studioId),
			jobManager,
			workerThread
		)

		parent.registerStatusEvents(workerThread)

		parent.startWorkerLoop(mongoUri, mongoDb)
		return parent
	}

	protected async initWorker(mongoUri: string, dbName: string, studioId: StudioId): Promise<void> {
		return this.#thread.init(mongoUri, dbName, studioId)
	}
	protected async invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void> {
		return this.#thread.invalidateCaches(invalidations)
	}
	protected async runJobInWorker(name: string, data: any): Promise<any> {
		return this.#thread.runJob(name, data)
	}
	protected async terminateWorkerThread(): Promise<void> {
		return ThreadedClassManager.destroy(this.#thread)
	}
	protected async restartWorkerThread(): Promise<void> {
		return ThreadedClassManager.restart(this.#thread, true)
	}
	public async workerLockChange(lockId: string, locked: boolean): Promise<void> {
		return this.#thread.lockChange(lockId, locked)
	}
}
