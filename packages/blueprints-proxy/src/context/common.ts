import { ICommonContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import * as crypto from 'crypto'
import { ParamsIfReturnIsNever, ParamsIfReturnIsValid } from '../helper'
import { callHelper, emitHelper, MySocket } from '../routers/util'
import { BlueprintToSofieMethods } from '..'

function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

export class CommonContext implements ICommonContext {
	private readonly _contextName: string

	readonly #socket: MySocket
	readonly #invocationId: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(identifier: string, socket: MySocket, invocationId: string) {
		this._contextName = identifier

		this.#socket = socket
		this.#invocationId = invocationId
	}

	protected emitMessage<T extends keyof BlueprintToSofieMethods>(
		name: T,
		data: ParamsIfReturnIsNever<BlueprintToSofieMethods[T]>[0]
	): void {
		return emitHelper(this.#socket, this.#invocationId, name, data)
	}
	protected async emitCall<T extends keyof BlueprintToSofieMethods>(
		name: T,
		data: ParamsIfReturnIsValid<BlueprintToSofieMethods[T]>[0]
	): Promise<ReturnType<BlueprintToSofieMethods[T]>> {
		return callHelper(this.#socket, this.#invocationId, name, data)
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
