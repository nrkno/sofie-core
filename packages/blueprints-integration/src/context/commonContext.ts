/**
 * Base context type that all others should extend from.
 * This is to provide logging and some other utilities
 */
export interface ICommonContext {
	/**
	 * Hash a string. Will return a unique string, to be used for all _id:s that are to be inserted in database
	 * @param originString A representation of the origin of the hash (for logging)
	 * @param originIsNotUnique If the originString is not guaranteed to be unique, set this to true
	 */
	getHashId: (originString: string, originIsNotUnique?: boolean) => string
	/** Un-hash, is return the string that created the hash */
	unhashId: (hash: string) => string

	/** Log a message to the sofie log with level 'debug' */
	logDebug: (message: string) => void
	/** Log a message to the sofie log with level 'info' */
	logInfo: (message: string) => void
	/** Log a message to the sofie log with level 'warn' */
	logWarning: (message: string) => void
	/** Log a message to the sofie log with level 'error' */
	logError: (message: string) => void
}

export function isCommonContext(obj: unknown): obj is ICommonContext {
	if (!obj || typeof obj !== 'object') {
		return false
	}

	const { getHashId, unhashId, logDebug, logInfo, logWarning, logError } = obj as ICommonContext

	return (
		typeof getHashId === 'function' &&
		typeof unhashId === 'function' &&
		typeof logDebug === 'function' &&
		typeof logInfo === 'function' &&
		typeof logWarning === 'function' &&
		typeof logError === 'function'
	)
}
