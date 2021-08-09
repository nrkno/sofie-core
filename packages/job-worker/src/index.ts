import { logger } from './logging'
import { ConnectionOptions } from 'bullmq'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent } from './profiler'
import { createMongoConnection } from './db'
import { createManualPromise, getRandomString, sleep } from '@sofie-automation/corelib/dist/lib'
import { StudioWorkerSet } from './workers/worker-set'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Db as MongoDb } from 'mongodb'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

const mongoUri = 'mongodb://127.0.0.1:3001?retryWrites=true&writeConcern=majority'
const dbName = 'meteor'
const connection: ConnectionOptions = {
	// TODO - something here?
}

/** Get the ids of the studios to run for */
async function getStudioIdsToRun(db: MongoDb): Promise<Array<StudioId>> {
	if (process.env.STUDIO_IDS) {
		// either run for a dedicated list of studios
		const ids = protectStringArray(process.env.STUDIO_IDS.split(','))
		logger.info(`Running for specified studios: ${JSON.stringify(ids)}`)
		return ids
	} else {
		// Or find the current studios, and run for everything
		const studios = await db
			.collection(CollectionName.Studios)
			.find({}, { projection: { _id: 1 } })
			.toArray()

		// TODO - watch for creation/deletion

		const ids = studios.map((s) => protectString(s._id))
		logger.warn(`Running for all studios: ${JSON.stringify(ids)}. Make sure there is only one worker running!`)
		return ids
	}
}

/** The unique id for this worker, used by the queue to track job ownership */
function getWorkerId(): string {
	if (process.env.WORKER_ID) {
		logger.info(`Running with id "${process.env.WORKER_ID}"`)
		return process.env.WORKER_ID
	} else {
		const id = getRandomString(10)
		logger.info(`Running with generated id "${id}"`)
		return id
	}
}

const workerId = getWorkerId()

setupApmAgent()

const shutdownPromise = createManualPromise<void>() // TODO - this should be .resolve/.reject in some places

void (async () => {
	const client = await createMongoConnection(mongoUri)

	client.on('close', () => {
		console.log('Mongo connection closed. Forcing exit')
		// TODO - this isnt a great error handling
		// eslint-disable-next-line no-process-exit
		process.exit(0)
	})

	const db = client.db(dbName)
	// Find the current studios
	const studioIds = await getStudioIdsToRun(db)

	if (studioIds.length === 0) {
		console.error('No studios to run for. Exiting')
		await sleep(10000)

		// eslint-disable-next-line no-process-exit
		process.exit(1)
	}

	const workers = new Map<StudioId, StudioWorkerSet>()

	for (const studioId of studioIds) {
		// Start up each studio, one at a time
		workers.set(
			studioId,
			await StudioWorkerSet.create(workerId, mongoUri, dbName, client, studioId, { connection })
		)
	}

	try {
		// Wait for something to trigger a shutdown
		await shutdownPromise
	} finally {
		// Terminate everything
		await Promise.allSettled(Array.from(workers.values()).map((w) => w.terminate()))

		// Ensures that the client will close when you finish/error
		await client.close()
	}
})()
