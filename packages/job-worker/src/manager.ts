import { JobSpec } from './main'

export interface JobManager {
	jobFinished: (id: string, startedTime: number, finishedTime: number, error: any, result: any) => Promise<void>
	// getNextJob: (queueName: string) => Promise<JobSpec>
	queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>
	subscribeToQueue: (queueName: string, workerId: string) => JobStream
}

export interface JobStream {
	next(): Promise<JobSpec>
	close(): Promise<void>
}
