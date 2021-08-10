import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StudioJobFunc, getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { IngestJobFunc, getIngestQueueName } from '@sofie-automation/corelib/dist/worker/ingest'
import { Queue, ConnectionOptions, QueueEvents, Job } from 'bullmq'
import { logger } from '../../lib/logging'
import PLazy from 'p-lazy'
import _ from 'underscore'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { Meteor } from 'meteor/meteor'

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

const connection: ConnectionOptions = {
	// TODO
}

const studioQueueCache = new Map<StudioId, [Queue, QueueEvents]>()
const ingestQueueCache = new Map<StudioId, [Queue, QueueEvents]>()

// type WrappedResultExt<TRes> = WrappedResult<TRes> & {
// 	completedTime: number
// }
type WrappedResult<T> = JobTimings & ({ error: Error | UserError } | { result: T })

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

	let queue0 = studioQueueCache.get(studioId)
	if (!queue0) {
		logger.info(`Setting up work queue for Studio "${studioId}"`)
		const queueId = getStudioQueueName(studioId)
		queue0 = [new Queue(queueId, { connection }), new QueueEvents(queueId, { connection })]
		studioQueueCache.set(studioId, queue0)
	}

	return pushJobToQueue(queue0[0], queue0[1], name, data)
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

	let queue0 = ingestQueueCache.get(studioId)
	if (!queue0) {
		logger.info(`Setting up work queue for Ingest"${studioId}"`)
		const queueId = getIngestQueueName(studioId)
		queue0 = [new Queue(queueId, { connection }), new QueueEvents(queueId, { connection })]
		ingestQueueCache.set(studioId, queue0)
	}

	return pushJobToQueue(queue0[0], queue0[1], name, data)
}

/**
 * Push a job into a work queue
 * @param queue Queue to push to
 * @param queueEvents Event stream for the provided queue
 * @param name Job name
 * @param data Job payload
 * @returns Promise resolving once job has been queued successfully
 */
async function pushJobToQueue<T>(
	queue: Queue,
	queueEvents: QueueEvents,
	name: string,
	data: unknown
): Promise<WorkerJob<T>> {
	const queuedTime = Date.now()
	const job = await queue.add(name, data, {
		// priority,
	})

	logger.debug(`Queued job #${job.id} of "${name}" to "${queue.name}"`)

	// TODO - timeouts
	// TODO - better errors
	// TODO - anything else from the old implementation

	// Lazily watch for completion once, to be used for multiple caller promises
	const completedPromise = PLazy.from<WrappedResult<T>>(async () => {
		try {
			// TODO - this should be rewritten to manuall use queueEvents
			// After reading the implementation, we can do that and avoid having to load the job again for getTimings
			const res: T = await job.waitUntilFinished(queueEvents)

			return {
				result: res,
				queueTime: queuedTime,
				startedTime: job.processedOn,
				finishedTime: job.finishedOn,
				completedTime: Date.now(),
			}
		} catch (e) {
			let e2 = e
			try {
				// Try and parse it as a UserError
				e2 = UserError.tryFromJSON(e.message)
			} catch (_e) {
				// ignore
			}

			return {
				error: e2,
				queueTime: queuedTime,
				startedTime: job.processedOn,
				finishedTime: job.finishedOn,
				completedTime: Date.now(),
			}
		}
	})

	return {
		complete: PLazy.from(async () => {
			// lazily await the result
			// TODO - should this error be re-wrapped?
			const res = await completedPromise

			if ('error' in res) {
				logger.debug(`Completed job #${job.id} with error of "${name}" to "${queue.name}"`)
				throw res.error
			} else {
				logger.debug(`Completed job #${job.id} with success of "${name}" to "${queue.name}"`)
				return res.result
			}
		}),
		getTimings: PLazy.from(async () => {
			// lazily await the completion
			// TODO - should this error be re-wrapped?
			const result = await completedPromise
			const result2 = _.pick(result, 'queueTime', 'startedTime', 'finishedTime', 'completedTime')

			// reload the job from the queue to get the updated times
			if (!job.id) throw new Error('No job id!')
			const job2 = await Job.fromId(queue, job.id)
			if (!job2) return result2

			return {
				...result2,
				startedTime: job2.processedOn,
				finishedTime: job2.finishedOn,
			}
		}),
	}
}
