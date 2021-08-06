import { logger } from './logging'
import { ConnectionOptions } from 'bullmq'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent } from './profiler'
import { createMongoConnection } from './db'
import { StudioWorkerParent } from './workers/studio/parent'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { LocksManager } from './locks'
import { IngestWorkerParent } from './workers/ingest/parent'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

console.log('hello world')

const mongoUri = 'mongodb://127.0.0.1:3001?retryWrites=true&writeConcern=majority'
const mongoDb = 'meteor'
const connection: ConnectionOptions = {
	// TODO - something here?
}

const studioId: StudioId = protectString('studio0') // the queue/worker is for a dedicated studio, so the id will be semi-hardcoded
const workerId = 'abc' // unique 'id' for the worker

setupApmAgent()

void (async () => {
	const client = await createMongoConnection(mongoUri)

	client.on('close', () => {
		console.log('Mongo connection closed. Forcing exit')
		// TODO - this isnt a great error handling
		// eslint-disable-next-line no-process-exit
		process.exit(0)
	})

	const locksManager = new LocksManager()

	const [studioWorker, ingestWorker] = await Promise.all([
		StudioWorkerParent.start(workerId, mongoUri, mongoDb, client, locksManager, studioId, {
			connection,
		}),
		IngestWorkerParent.start(workerId, mongoUri, mongoDb, client, locksManager, studioId, {
			connection,
		}),
	])

	try {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			// temporary until parent does more dynamic thread creation/deletion
			await sleep(10000)
		}
	} finally {
		await Promise.allSettled([studioWorker.terminate(), ingestWorker.terminate()])

		// Ensures that the client will close when you finish/error
		await client.close()
	}
})()
