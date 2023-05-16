import { ClientSession } from 'mongodb'
import { IMongoTransaction } from './collections'

export class MongoTransaction implements IMongoTransaction {
	#session: ClientSession
	#id: string

	get rawSession(): ClientSession {
		return this.#session
	}

	get id(): string {
		return this.#id
	}

	constructor(session: ClientSession, id: string) {
		this.#session = session
		this.#id = id
	}
}
