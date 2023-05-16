import { ClientSession } from 'mongodb'
import { IMongoTransaction } from './collections'

export class MongoTransaction implements IMongoTransaction {
	#session: ClientSession

	get rawSession(): ClientSession {
		return this.#session
	}

	constructor(session: ClientSession) {
		this.#session = session
	}

	async test(): Promise<void> {
		// TODO
	}

	// constructor(client: MongoClient) {
	// 	this.#session = client.startSession() // TODO - configure options?

	// 	this.#session.startTransaction() // TODO - configure options?
	// }

	// async commitTransaction(): Promise<void> {
	// 	await this.#session.commitTransaction()
	// }
	// async abortTransaction(): Promise<void> {
	// 	await this.#session.abortTransaction()
	// }
}
