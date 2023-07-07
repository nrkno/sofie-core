import { ICommonContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import * as crypto from 'crypto'

function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

export class CommonContext implements ICommonContext {
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(identifier: string) {
		this._contextName = identifier
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
