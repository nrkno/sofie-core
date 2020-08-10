import { i18nTranslator } from '../../client/ui/i18n'

/**
 * @enum - A translatable message (i18next)
 */
export interface ITranslatableMessage {
	/** the message key (we use literal strings in English as keys for now) */
	key: string
	/** arguments for the message template */
	args?: { [key: string]: any }
	/** namespace used */
	namespace?: string
}

/**
 * Translates a message with arguments applied. Uses the application's
 * translation service (see {@link '../../client/ui/i18n'}).
 *
 * @param {ITranslatableMessage} translatable - the translatable to translate
 * @returns the translation with arguments applied
 */
export function translateMessage(translatable: ITranslatableMessage): string {
	const { key: message, args, namespace } = translatable

	return i18nTranslator(message, { ns: namespace, replace: { ...args } })
}

/**
 * Type check predicate for the ITranslatableMessage interface
 *
 * @param obj the value to typecheck
 *
 * @returns {boolean} true if the value implements the interface, false if not
 */
export function isTranslatableMessage(obj: any): obj is ITranslatableMessage {
	if (!obj) {
		return false
	}

	const { message, args, namespace } = obj

	if (!message || typeof message !== 'string') {
		return false
	}

	if (args && !checkArgs(args)) {
		return false
	}

	if (namespace && typeof namespace !== 'string') {
		return false
	}

	return true
}

function checkArgs(args: any): args is { [key: string]: any } {
	if (args === undefined || args === null) {
		return false
	}

	// this is good enough for object literals, which is what args essentially is
	return args.constructor === Object
}
