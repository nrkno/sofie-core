import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { MongoClient } from 'mongodb'
import { IDirectCollections, wrapMongoCollection } from '../collection'

export async function createMongoConnection(mongoUri: string): Promise<MongoClient> {
	const client = new MongoClient(mongoUri)
	await client.connect()
	return client
}

export function getMongoCollections(client: MongoClient, dbName: string): IDirectCollections {
	const database = client.db(dbName)
	const collections: IDirectCollections = Object.seal({
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
		RundownBaselineAdLibPieces: wrapMongoCollection(database.collection(CollectionName.RundownBaselineAdLibPieces)),
		RundownBaselineObjects: wrapMongoCollection(database.collection(CollectionName.RundownBaselineObjects)),
		RundownPlaylists: wrapMongoCollection(database.collection(CollectionName.RundownPlaylists)),
		Segments: wrapMongoCollection(database.collection(CollectionName.Segments)),
		ShowStyleBases: wrapMongoCollection(database.collection(CollectionName.ShowStyleBases)),
		ShowStyleVariants: wrapMongoCollection(database.collection(CollectionName.ShowStyleVariants)),
		Studios: wrapMongoCollection(database.collection(CollectionName.Studios)),
		Timelines: wrapMongoCollection(database.collection(CollectionName.Timelines)),

		ExpectedPackages: wrapMongoCollection(database.collection(CollectionName.ExpectedPackages)),
		PackageInfos: wrapMongoCollection(database.collection(CollectionName.PackageInfos)),
	})
	return collections
}
