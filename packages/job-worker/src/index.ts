import { logger } from './logging'
import { ConnectionOptions, QueueScheduler, Worker } from 'bullmq'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getStudioQueueName } from '@sofie-automation/corelib/dist/worker/studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent, startTransaction } from './profiler'
import { createMongoConnection } from './db'
import { spawn, Thread, Worker as ThreadWorker } from 'threads'
import { StudioMethods } from './workers/studio'
import { UserError } from '@sofie-automation/corelib/dist/error'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

console.log('hello world')

const mongoUri = 'mongodb://127.0.0.1:3001?retryWrites=true&writeConcern=majority'
const mongoDb = 'meteor'
const connection: ConnectionOptions = {
	// TODO - something here?
}

const studioId: StudioId = protectString('studio0') // the queue/worker is for a dedicated studio, so the id will be semi-hardcoded
const token = 'abc' // unique 'id' for the worker
const studioQueue = new Worker(getStudioQueueName(studioId), undefined, { connection })

// This is needed to handle timeouts or something
const studioScheduler = new QueueScheduler(getStudioQueueName(studioId), { connection })

setupApmAgent()

void (async () => {
	const client = await createMongoConnection(mongoUri)

	const studioWorker = await spawn<StudioMethods>(new ThreadWorker('./workers/studio'))
	Thread.events(studioWorker).subscribe((event) => console.log('Thread event:', event))

	try {
		await studioWorker.init(mongoUri, mongoDb, studioId)
		// const collections = getMongoCollections(client, mongoDb)

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const job = await studioQueue.getNextJob(token, {
				// block: true, // wait for there to be a job ready
			})

			// TODO - job lock may timeout, we need to run at an interval to make sure it doesnt
			// TODO - enforce a timeout? we could kill the thread once it reaches the limit as a hard abort

			// we may not get a job even when blocking, so try again
			if (job) {
				const transaction = startTransaction(job.name, 'worker-studio')
				if (transaction) {
					transaction.setLabel('studioId', unprotectString(studioId))
				}

				try {
					console.log('Running work ', job.id, job.name, JSON.stringify(job.data))

					// TODO - this never resolves if the worker dies. Hopefully the bug will be fixed, or swap it out for threadedclass https://github.com/andywer/threads.js/issues/386
					const result = await studioWorker.runJob(job.name, job.data)

					await job.moveToCompleted(result, token, false)
				} catch (e) {
					console.log('job errored', e)
					// stringify the error to preserve the UserError
					const e2 = e instanceof Error ? e : new Error(UserError.toJSON(e))

					await job.moveToFailed(e2, token)
				}
				console.log('the end')
				transaction?.end()
			}
		}
	} finally {
		await Thread.terminate(studioWorker)

		// Ensures that the client will close when you finish/error
		await client.close()
	}
})()
