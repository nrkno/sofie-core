import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

export enum LogLevel {
	SILLY = 'silly',
	DEBUG = 'debug',
	VERBOSE = 'verbose',
	INFO = 'info',
	WARN = 'warn',
	ERROR = 'error',
	NONE = 'crit',
}

/** Generate the translation for a string, to be applied later when it gets rendered */
export function generateTranslation(
	key: string,
	args?: { [k: string]: any },
	namespaces?: string[]
): ITranslatableMessage {
	return {
		key,
		args,
		namespaces,
	}
}
