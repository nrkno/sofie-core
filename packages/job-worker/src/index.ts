import { logger } from './logging'
import { ConnectionOptions, Worker } from 'bullmq'
import { MongoClient } from 'mongodb'
import { IDirectCollections, wrapMongoCollection } from './collection'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

console.log('hello world')

const mongoUri = 'mongodb://127.0.0.1:3001?retryWrites=true&writeConcern=majority'
const connection: ConnectionOptions = {
	// TODO - something here?
}

const token = 'abc' // unique 'id' for the worker
const worker = new Worker('studio', undefined, { connection })

void (async () => {
	const client = new MongoClient(mongoUri)

	try {
		await client.connect()

		const database = client.db('meteor') // TODO - dynamic
		const collections: IDirectCollections = {
			AdLibActions: wrapMongoCollection(database.collection(CollectionName.AdLibActions)),
			AdLibPieces: wrapMongoCollection(database.collection(CollectionName.AdLibPieces)),
			Blueprints: wrapMongoCollection(database.collection(CollectionName.Blueprints)),
			BucketAdLibActions: wrapMongoCollection(database.collection(CollectionName.BucketAdLibActions)),
			BucketAdLibPieces: wrapMongoCollection(database.collection(CollectionName.BucketAdLibPieces)),
			ExpectedMediaItems: wrapMongoCollection(database.collection(CollectionName.ExpectedMediaItems)),
			ExpectedPlayoutItems: wrapMongoCollection(database.collection(CollectionName.ExpectedPlayoutItems)),
			IngestDataCache: wrapMongoCollection(database.collection(CollectionName.IngestDataCache)),
			Parts: wrapMongoCollection(database.collection(CollectionName.Parts)),
			PartInstances: wrapMongoCollection(database.collection(CollectionName.PartInstances)),
			PeripheralDevices: wrapMongoCollection(database.collection(CollectionName.PeripheralDevices)),
			PeripheralDeviceCommands: wrapMongoCollection(database.collection(CollectionName.PeripheralDeviceCommands)),
			Pieces: wrapMongoCollection(database.collection(CollectionName.Pieces)),
			PieceInstances: wrapMongoCollection(database.collection(CollectionName.PieceInstances)),
			Rundowns: wrapMongoCollection(database.collection(CollectionName.Rundowns)),
			RundownBaselineAdLibActions: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibActions)
			),
			RundownBaselineAdLibPieces: wrapMongoCollection(
				database.collection(CollectionName.RundownBaselineAdLibPieces)
			),
			RundownBaselineObjects: wrapMongoCollection(database.collection(CollectionName.RundownBaselineObjects)),
			RundownPlaylists: wrapMongoCollection(database.collection(CollectionName.RundownPlaylists)),
			Segments: wrapMongoCollection(database.collection(CollectionName.Segments)),
			ShowStyleBases: wrapMongoCollection(database.collection(CollectionName.ShowStyleBases)),
			ShowStyleVariants: wrapMongoCollection(database.collection(CollectionName.ShowStyleVariants)),
			Studios: wrapMongoCollection(database.collection(CollectionName.Studios)),
			Timelines: wrapMongoCollection(database.collection(CollectionName.Timelines)),

			ExpectedPackages: wrapMongoCollection(database.collection(CollectionName.ExpectedPackages)),
			PackageInfos: wrapMongoCollection(database.collection(CollectionName.PackageInfos)),
		}

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const job = await worker.getNextJob(token, {
				// block: true, // wait for there to be a job ready
			})

			// we may not get a job even when blocking, so try again
			if (job) {
				try {
					// TODO Something
					console.log('Running work ', job.id, JSON.stringify(job.data))

					const result = await runJob(job.name, job.data)

					await job.moveToCompleted(result, token, false)
				} catch (e) {
					await job.moveToFailed(e, token)
				}
			}
		}
	} finally {
		// Ensures that the client will close when you finish/error
		await client.close()
	}
})()

async function runJob(name: string, data: any): Promise<any> {
	// TODO

	switch (name) {
		case 'updateTimeline':
			return updateTimelineTest(data)
	}

	return `Had success at ${Date.now()}`
}

async function updateTimelineTest(data: any): Promise<void> {
	//
}
