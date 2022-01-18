import { logger } from './logging'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupApmAgent } from './profiler'
import { createMongoConnection } from './db'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { StudioWorkerSet } from './workers/worker-set'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Db as MongoDb, MongoClient } from 'mongodb'
import { JobManager } from './manager'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { setupInfluxDb } from './influx'

setupApmAgent()
setupInfluxDb()

export interface JobSpec {
	id: string
	name: string
	data: unknown
}

export type FastTrackTimelineFunc = (newTimeline: TimelineComplete) => Promise<void>

export abstract class JobWorkerBase {
	readonly #workerId = getWorkerId()
	readonly #workers = new Map<StudioId, StudioWorkerSet>()

	readonly #fastTrackTimeline: FastTrackTimelineFunc | null

	#client: MongoClient | undefined

	#jobManager: JobManager

	constructor(jobManager: JobManager, fastTrackTimeline: FastTrackTimelineFunc | null) {
		this.#jobManager = jobManager

		this.#fastTrackTimeline = fastTrackTimeline
		if (!this.#fastTrackTimeline) {
			logger.info(`Fast-track of timeline updates disabled`)
		}
	}

	public async run(mongoUri: string, dbName: string): Promise<void> {
		if (this.#client) throw new Error('Already running')

		logger.info('Starting')

		this.#client = await createMongoConnection(mongoUri)

		this.#client.on('close', () => {
			console.log('Mongo connection closed. Forcing exit')
			// Note: This is terribele error handling, but it does the job.
			// If we start handling this more gracefully, then we will need to make sure to avoid/kill jobs being processed and flush all caches upon reconnection
			// eslint-disable-next-line no-process-exit
			process.exit(0)
		})

		const db = this.#client.db(dbName)
		// Find the current studios
		const studioIds = await getStudioIdsToRun(db)
		for (const studioId of studioIds) {
			// Start up each studio, one at a time
			this.#workers.set(
				studioId,
				await StudioWorkerSet.create(
					this.#workerId,
					mongoUri,
					dbName,
					this.#client,
					studioId,
					this.#jobManager,
					this.#fastTrackTimeline
				)
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

		// Watch for creation/deletion of studios
		db.collection(CollectionName.Studios)
			.watch([], {
				batchSize: 1,
			})
			.on('change', (change) => {
				if (change.operationType === 'update' || change.operationType === 'replace') {
					// These are not important
					return
				} else {
					// Something about the list of studios that exist has changed, lets restart
					// The easiest thing to do is to restart the process. This will happen so rarely, its probably not worth trying to improve on

					// eslint-disable-next-line no-process-exit
					process.exit(1)
				}
			})
			.on('end', () => {
				logger.warn(`Changes stream for Studios ended`)
				// Note: This is terribele error handling, but it does the job.
				// eslint-disable-next-line no-process-exit
				process.exit(1)
			})

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
