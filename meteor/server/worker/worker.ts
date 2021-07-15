import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StudioJobFunc, getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { Queue, ConnectionOptions, QueueEvents } from 'bullmq'
import { logger } from '../../lib/logging'
import PLazy from 'p-lazy'
import _ from 'underscore'

// class QueueWrapper {}

// const WorkQueueCache = new Map<string, QueueWrapper>()

// export const a = 1

// type JobNames = keyof StudioJobFunc

export interface JobTimings {
	queuedTime: number
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

// type WrappedResultExt<TRes> = WrappedResult<TRes> & {
// 	completedTime: number
// }
type WrappedResult<T> = JobTimings & ({ error: Error } | { result: T })

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
	let queue = studioQueueCache.get(studioId)
	if (!queue) {
		logger.info(`Setting up work queue for Studio "${studioId}"`)
		const queueId = getStudioQueueName(studioId)
		queue = [new Queue(queueId, { connection }), new QueueEvents(queueId, { connection })]
		studioQueueCache.set(studioId, queue)
	}

	const job = await queue[0].add(name, data, {
		// priority,
	})
	const queuedTime = Date.now()

	// TODO - timeouts
	// TODO - better errors
	// TODO - anything else from the old implementation

	// Lazily watch for completion once, to be used for multiple caller promises
	const completedPromise = PLazy.from<WrappedResult<ReturnType<StudioJobFunc[T]>>>(async () => {
		try {
			const res: ReturnType<StudioJobFunc[T]> = await job.waitUntilFinished(queueEvents)

			return {
				result: res,
				queuedTime: queuedTime,
				startedTime: job.processedOn,
				finishedTime: job.finishedOn,
				completedTime: Date.now(),
			}
		} catch (e) {
			return {
				error: e,
				queuedTime: queuedTime,
				startedTime: job.processedOn,
				finishedTime: job.finishedOn,
				completedTime: Date.now(),
			}
		}
	})

	const queueEvents = queue[1]
	return {
		complete: PLazy.from(async () => {
			// lazily await the result
			// TODO - should this error be re-wrapped?
			const res = await completedPromise

			if ('error' in res) {
				throw res.error
			} else {
				return res.result
			}
		}),
		getTimings: PLazy.from(async () => {
			// lazily await the completion
			// TODO - should this error be re-wrapped?
			const result = await completedPromise

			return _.pick(result, 'queuedTime', 'startedTime', 'finishedTime', 'completedTime')
		}),
	}
}
