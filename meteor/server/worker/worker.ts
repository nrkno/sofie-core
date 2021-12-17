import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getStudioQueueName, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { getIngestQueueName, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { logger } from '../../lib/logging'
import { Meteor } from 'meteor/meteor'
import { FORCE_CLEAR_CACHES_JOB } from '@sofie-automation/corelib/dist/worker/shared'
import { threadedClass, Promisify, ThreadedClassManager } from 'threadedclass'
import { JobSpec } from '@sofie-automation/job-worker/dist/main'
import { IpcJobWorker } from '@sofie-automation/job-worker/dist/ipc'
import {
	createManualPromise,
	getCurrentTime,
	getRandomString,
	ManualPromise,
	stringifyError,
	waitForPromise,
} from '../../lib/lib'
import { Time } from 'superfly-timeline'

interface JobEntry {
	spec: JobSpec
	complete: JobCompleted | null
}

interface JobQueue {
	jobs: JobEntry[]
	/** Notify that there is a job waiting */
	notify: ManualPromise<JobSpec> | null
}

type JobCompleted = (startedTime: number, finishedTime: number, err: any, result: any) => void

const queues = new Map<string, JobQueue>()
const runningJobs = new Map<string, JobCompleted>()

function getOrCreateQueue(queueName: string): JobQueue {
	let queue = queues.get(queueName)
	if (!queue) {
		queue = {
			jobs: [],
			notify: null,
		}
		queues.set(queueName, queue)
	}
	return queue
}

async function jobFinished(
	id: string,
	startedTime: number,
	finishedTime: number,
	err: any,
	result: any
): Promise<void> {
	const job = runningJobs.get(id)
	if (job) {
		runningJobs.delete(id)
		job(startedTime, finishedTime, err, result)
	}
}
async function getNextJob(queueName: string): Promise<JobSpec> {
	const queue = getOrCreateQueue(queueName)
	const job = queue.jobs.shift()
	if (job) {
		if (job.complete) runningJobs.set(job.spec.id, job.complete)
		return job.spec
	}

	// Already something waiting? Reject it, as we replace it
	if (queue.notify) {
		const oldNotify = queue.notify

		Meteor.defer(() => {
			try {
				// Notify the worker in the background
				oldNotify.manualReject(new Error('new handler added'))
			} catch (e) {
				// Ignore
			}
		})
	}

	// Wait to be notified about a job
	queue.notify = createManualPromise()
	return queue.notify
}
async function queueJob(queueName: string, jobName: string, jobData: unknown): Promise<void> {
	queueJobInner(queueName, {
		spec: {
			id: getRandomString(),
			name: jobName,
			data: jobData,
		},
		complete: null,
	})
}

function queueJobInner(queueName: string, job0: JobEntry): void {
	// const queueTime = getCurrentTime()

	const queue = getOrCreateQueue(queueName)
	queue.jobs.push(job0)

	if (queue.notify) {
		const notify = queue.notify
		const job = queue.jobs.shift()
		if (job) {
			if (job.complete) runningJobs.set(job.spec.id, job.complete)

			queue.notify = null
			Meteor.defer(() => {
				try {
					// Notify the worker in the background
					notify.manualResolve(job.spec)
				} catch (e) {
					// Queue failed, inform caller
					if (job.complete) job.complete(0, 0, e, null)
				}
			})
		}
	}
}

function queueJobWrapped<TRes>(queueName: string, job: JobSpec, now: Time): WorkerJob<TRes> {
	const { res, handler } = wrapResult<TRes>(job.id, now)

	queueJobInner(queueName, {
		spec: job,
		complete: handler,
	})

	return res
}

let worker: Promisify<IpcJobWorker> | undefined
Meteor.startup(() => {
	// Startup the worker 'parent' at startup
	worker = waitForPromise(
		threadedClass<IpcJobWorker, typeof IpcJobWorker>(
			'@sofie-automation/job-worker/dist/main.js',
			'JobWorker',
			[jobFinished, getNextJob, queueJob],
			{}
		)
	)

	ThreadedClassManager.onEvent(worker, 'restarted', () => {
		logger.warn(`Worker threads restarted`)

		// TODO
		worker!.run().catch((e) => {
			logger.error(`Failed to reinit worker threads after restart: ${stringifyError(e)}`)
		})
	})
	ThreadedClassManager.onEvent(worker, 'thread_closed', () => {
		// Thread closed, reject all jobs
		const now = getCurrentTime()
		for (const job of runningJobs.values()) {
			job(now, now, new Error('Thread closed'), null)
		}
		runningJobs.clear()
	})

	// TODO
	waitForPromise(worker.run())
})

export interface JobTimings {
	queueTime: number
	startedTime: number | undefined
	finishedTime: number | undefined
	completedTime: number
}

export interface WorkerJob<TRes> {
	/** Promise returning the result. Resolved upon completion of the job */
	complete: Promise<TRes>
	/** Promise returning the timings of an execution */
	getTimings: Promise<JobTimings>
	// abort: () => Promise<boolean> // Attempt to abort the job. Returns whether it was successful
}

/**
 * Queue a force clear caches job for all workers
 * @param studioIds Studios to clear caches for
 */
export async function QueueForceClearAllCaches(studioIds: StudioId[]): Promise<void> {
	const jobs: Array<WorkerJob<any>> = []

	if (!worker) throw new Meteor.Error(500, `Worker hasn't been initialized!`)

	// TODO - can we push these higher priority?
	const now = getCurrentTime()

	for (const studioId of studioIds) {
		// Clear studio
		jobs.push(
			queueJobWrapped(
				getStudioQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)

		// Clear ingest
		jobs.push(
			queueJobWrapped(
				getIngestQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)

		// Clear events
		jobs.push(
			queueJobWrapped(
				getEventsQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)
	}

	// Wait for the completion
	await Promise.allSettled(jobs.map(async (job) => job.complete))
}

/**
 * Queue a job for a studio
 * @param name Job name
 * @param studioId Id of the studio
 * @param data Job payload
 * @returns Promise resolving once job has been queued successfully
 */
export async function QueueStudioJob<T extends keyof StudioJobFunc>(
	name: T,
	studioId: StudioId,
	data: Parameters<StudioJobFunc[T]>[0]
): Promise<WorkerJob<ReturnType<StudioJobFunc[T]>>> {
	if (!studioId) throw new Meteor.Error(500, 'Missing studioId')

	const now = getCurrentTime()
	return queueJobWrapped(
		getStudioQueueName(studioId),
		{
			id: getRandomString(),
			name: name,
			data: data,
		},
		now
	)
}

/**
 * Queue a job for ingest
 * @param name Job name
 * @param studioId Id of the studio
 * @param data Job payload
 * @returns Promise resolving once job has been queued successfully
 */
export async function QueueIngestJob<T extends keyof IngestJobFunc>(
	name: T,
	studioId: StudioId,
	data: Parameters<IngestJobFunc[T]>[0]
): Promise<WorkerJob<ReturnType<IngestJobFunc[T]>>> {
	if (!studioId) throw new Meteor.Error(500, 'Missing studioId')

	const now = getCurrentTime()
	return queueJobWrapped(
		getIngestQueueName(studioId),
		{
			id: getRandomString(),
			name: name,
			data: data,
		},
		now
	)
}

function wrapResult<TRes>(jobId: string, queueTime: Time): { res: WorkerJob<TRes>; handler: JobCompleted } {
	// logger.debug(`Queued job #${job.id} of "${name}" to "${queue.name}"`)

	const complete = createManualPromise<TRes>()
	const getTimings = createManualPromise<JobTimings>()

	// TODO: Worker - timeouts
	// TODO: Worker - better errors
	// TODO: Worker - anything else from the old implementation

	const handler: JobCompleted = (startedTime: number, finishedTime: number, err: any, res: any) => {
		try {
			if (err) {
				logger.debug(`Completed job #${jobId} with error`)
				complete.manualReject(err)
			} else {
				logger.debug(`Completed job #${jobId} with success`)
				complete.manualResolve(res)
			}
		} catch (e) {
			logger.error(`Job completion failed: ${stringifyError(e)}`)
		}

		try {
			getTimings.manualResolve({
				queueTime,
				startedTime,
				finishedTime,
				completedTime: getCurrentTime(),
			})
		} catch (e) {
			logger.error(`Job timing resolve failed: ${stringifyError(e)}`)
		}
	}

	return {
		res: {
			complete,
			getTimings,
		},
		handler,
	}
}
