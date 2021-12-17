import { logger } from './logging'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent } from './profiler'
import { createMongoConnection } from './db'
import { getRandomString, sleep } from '@sofie-automation/corelib/dist/lib'
import { StudioWorkerSet } from './workers/worker-set'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Db as MongoDb, MongoClient } from 'mongodb'
import { JobManager } from './manager'

setupApmAgent()

export interface JobSpec {
	id: string
	name: string
	data: unknown
}

export abstract class JobWorkerBase {
	readonly #workerId = getWorkerId()
	readonly #workers = new Map<StudioId, StudioWorkerSet>()

	#client: MongoClient | undefined

	#jobManager: JobManager

	constructor(jobManager: JobManager) {
		this.#jobManager = jobManager
	}

	public async run(mongoUri: string, dbName: string): Promise<void> {
		if (this.#client) throw new Error('Already running')

		logger.info('Starting')

		this.#client = await createMongoConnection(mongoUri)

		this.#client.on('close', () => {
			console.log('Mongo connection closed. Forcing exit')
			// TODO: Worker - this isnt a great error handling
			// eslint-disable-next-line no-process-exit
			process.exit(0)
		})

		const db = this.#client.db(dbName)
		// Find the current studios
		const studioIds = await getStudioIdsToRun(db)

		if (studioIds.length === 0) {
			console.error('No studios to run for. Exiting')
			await sleep(10000)

			// eslint-disable-next-line no-process-exit
			process.exit(1)
		}

		for (const studioId of studioIds) {
			// Start up each studio, one at a time
			this.#workers.set(
				studioId,
				await StudioWorkerSet.create(this.#workerId, mongoUri, dbName, this.#client, studioId, this.#jobManager)
			)
		}
	}

	public async stop(): Promise<void> {
		// Terminate everything
		await Promise.allSettled(Array.from(this.#workers.values()).map((w) => w.terminate()))
		this.#workers.clear()

		if (this.#client) {
			// Ensures that the client will close when you finish/error
			await this.#client.close()
		}
	}
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

		// TODO: Worker - watch for creation/deletion

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
