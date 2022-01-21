import { LogEntry } from 'winston'
import { addThreadNameToLogLine, interceptLogging } from './logging'
import { FastTrackTimelineFunc, JobSpec, JobWorkerBase } from './main'
import { JobManager, JobStream } from './manager'

/**
 * A very simple implementation of JobManager, that is designed to work via threadedClass over IPC
 */
class IpcJobManager implements JobManager {
	constructor(
		public readonly jobFinished: (
			id: string,
			startedTime: number,
			finishedTime: number,
			error: any,
			result: any
		) => Promise<void>,
		public readonly queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>,
		private readonly getNextJob: (queueName: string) => Promise<JobSpec>
	) {}

	public subscribeToQueue(queueName: string, _workerId: string): JobStream {
		return {
			next: async () => this.getNextJob(queueName),
			close: () => Promise.resolve(),
		}
	}
}

/**
 * Entrypoint for threadedClass
 */
export class IpcJobWorker extends JobWorkerBase {
	constructor(
		jobFinished: (id: string, startedTime: number, finishedTime: number, error: any, result: any) => Promise<void>,
		getNextJob: (queueName: string) => Promise<JobSpec>,
		queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>,
		logLine: (msg: LogEntry) => Promise<void>,
		fastTrackTimeline: FastTrackTimelineFunc
	) {
		// Intercept winston to pipe back over ipc
		interceptLogging((...args) => logLine(addThreadNameToLogLine('worker-parent', ...args)))

		super(new IpcJobManager(jobFinished, queueJob, getNextJob), logLine, fastTrackTimeline)
	}
}
