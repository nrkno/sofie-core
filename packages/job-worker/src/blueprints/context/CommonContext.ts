import { ICommonContext, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { logger } from '../../logging.js'
import { assertNever, getHash, isInProductionMode } from '@sofie-automation/corelib/dist/lib'

export interface ContextInfo {
	/** Short name for the context (eg the blueprint function being called) */
	name: string
	/** Full identifier info for the context. Should be able to identify the rundown/studio/blueprint etc being executed */
	identifier: string
}

/** Common */

export class CommonContext implements ICommonContext {
	private readonly _contextIdentifier: string
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(info: ContextInfo) {
		this._contextIdentifier = info.identifier
		this._contextName = info.name
	}
	getHashId(str: string, isNotUnique?: boolean): string {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextIdentifier + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		logger.debug(this.makeLogMessage(message))
	}
	logInfo(message: string): void {
		logger.info(this.makeLogMessage(message))
	}
	logWarning(message: string): void {
		logger.warn(this.makeLogMessage(message))
	}
	logError(message: string): void {
		logger.error(this.makeLogMessage(message))
	}
	private makeLogMessage(message: string): string {
		if (isInProductionMode()) {
			// Log the context identifier in production mode
			return `"${this._contextName}": "${message}"\n(${this._contextIdentifier})`
		} else {
			// Dont log the context identifier in dev mode, for cleaner logs
			return `"${this._contextName}": "${message}"`
		}
	}
	protected logNote(message: string, type: NoteSeverity): void {
		if (type === NoteSeverity.ERROR) {
			this.logError(message)
		} else if (type === NoteSeverity.WARNING) {
			this.logWarning(message)
		} else if (type === NoteSeverity.INFO) {
			this.logInfo(message)
		} else {
			assertNever(type)
			this.logDebug(message)
		}
	}
}
