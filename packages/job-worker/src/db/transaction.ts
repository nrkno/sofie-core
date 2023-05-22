import { ClientSession } from 'mongodb'
import { IMongoTransaction } from './collections'

/**
 * Represents a MongoDB session and transaction, backed by a real MongoDB session
 */
export class MongoTransaction implements IMongoTransaction {
	#session: ClientSession
	#id: string

	/**
	 * Used by the collection implementation to access the session needed to make the call.
	 */
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
