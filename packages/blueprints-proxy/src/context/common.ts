import { ICommonContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import * as crypto from 'crypto'
import { ParamsIfReturnIsNever, ParamsIfReturnIsValid } from '../helper'
import { callHelper, emitHelper, MySocket } from '../routers/util'
import { ServerToClientEvents } from '..'

function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

export class CommonContext implements ICommonContext {
	private readonly _contextName: string

	readonly #socket: MySocket
	readonly #functionId: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(identifier: string, socket: MySocket, functionId: string) {
		this._contextName = identifier

		this.#socket = socket
		this.#functionId = functionId
	}

	protected emitMessage<T extends keyof ServerToClientEvents>(
		name: T,
		data: ParamsIfReturnIsNever<ServerToClientEvents[T]>[0]
	): void {
		return emitHelper(this.#socket, this.#functionId, name, data)
	}
	protected emitCall<T extends keyof ServerToClientEvents>(
		name: T,
		data: ParamsIfReturnIsValid<ServerToClientEvents[T]>[0]
	): Promise<ReturnType<ServerToClientEvents[T]>> {
		return callHelper(this.#socket, this.#functionId, name, data)
	}

	getHashId(str: string, isNotUnique?: boolean): string {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextName + '_' + str.toString()) // TODO - is this unique enough?
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		console.debug(`"${this._contextName}": "${message}"`)
	}
	logInfo(message: string): void {
		console.info(`"${this._contextName}": "${message}"`)
	}
	logWarning(message: string): void {
		console.warn(`"${this._contextName}": "${message}"`)
	}
	logError(message: string): void {
		console.error(`"${this._contextName}": "${message}"`)
	}
	protected logNote(message: string, type: NoteSeverity): void {
		if (type === NoteSeverity.ERROR) {
			this.logError(message)
		} else if (type === NoteSeverity.WARNING) {
			this.logWarning(message)
		} else if (type === NoteSeverity.INFO) {
			this.logInfo(message)
		} else {
			// assertNever(type)
			this.logDebug(message)
		}
	}
}
