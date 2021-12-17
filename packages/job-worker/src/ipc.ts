import { JobSpec, JobWorkerBase } from './main'
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
		queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>
	) {
		super(new IpcJobManager(jobFinished, queueJob, getNextJob))
	}
}
