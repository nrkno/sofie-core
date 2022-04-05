import { IntervalWorkerChild } from './child'
import { InvalidateWorkerDataCache } from '../caches'
import { WorkerParentBase, WorkerParentBaseOptions, WorkerParentOptions } from '../parent-base'
import { AnyLockEvent } from '../locks'
import { getIntervalQueueName } from '@sofie-automation/corelib/dist/worker/interval'
import { Promisify, threadedClass, ThreadedClassManager } from 'threadedclass'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main'

export class IntervalWorkerParent extends WorkerParentBase {
	readonly #thread: Promisify<IntervalWorkerChild>

	private constructor(baseOptions: WorkerParentBaseOptions, thread: Promisify<IntervalWorkerChild>) {
		super(baseOptions)
		this.#thread = thread
	}

	static async start(
		baseOptions: WorkerParentOptions,
		mongoUri: string,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null
	): Promise<IntervalWorkerParent> {
		const queueName = getIntervalQueueName(baseOptions.studioId)
		const prettyName = queueName

		const emitLockEvent = async (e: AnyLockEvent) => baseOptions.locksManager.handleLockEvent(queueName, e)

		const workerThread = await threadedClass<IntervalWorkerChild, typeof IntervalWorkerChild>(
			'./child',
			'IntervalWorkerChild',
			[baseOptions.studioId, emitLockEvent, baseOptions.jobManager.queueJob, logLine, fastTrackTimeline],
			{
				instanceName: `Interval: ${baseOptions.studioId}`,
			}
		)

		// create and start the worker
		const parent = new IntervalWorkerParent({ ...baseOptions, queueName, prettyName }, workerThread)

		parent.registerStatusEvents(workerThread)

		parent.startWorkerLoop(mongoUri)
		return parent
	}

	protected async initWorker(mongoUri: string, dbName: string): Promise<void> {
		return this.#thread.init(mongoUri, dbName)
	}
	protected async invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void> {
		return this.#thread.invalidateCaches(invalidations)
	}
	protected async runJobInWorker(name: string, data: unknown): Promise<any> {
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
