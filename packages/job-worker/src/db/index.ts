import { MongoClient } from 'mongodb'

export * from './collections'
export * from './collection'

export async function createMongoConnection(mongoUri: string): Promise<MongoClient> {
	const client = new MongoClient(mongoUri, {
		ignoreUndefined: true,
	})
	await client.connect()
	return client
}
