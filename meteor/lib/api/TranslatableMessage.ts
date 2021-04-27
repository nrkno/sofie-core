import { TFunction } from 'i18next'
import { ITranslatableMessage as IBlueprintTranslatableMessage } from '@sofie-automation/blueprints-integration'

/**
 * @enum - A translatable message (i18next)
 */
export interface ITranslatableMessage extends IBlueprintTranslatableMessage {
	/** namespace used */
	namespaces?: Array<string>
}

/**
 * Convenience function to translate a message using a supplied translation function.
 *
 * @param {ITranslatableMessage} translatable - the translatable to translate
 * @param {TFunction} i18nTranslator - the translation function to use
 * @returns the translation with arguments applied
 */
export function translateMessage(translatable: ITranslatableMessage, i18nTranslator: TFunction): string {
	// the reason for injecting the translation function rather than including the inited function from i18n.ts
	// is to avoid a situation where this is accidentally used from the server side causing an error
	const { key: message, args, namespaces } = translatable

	return i18nTranslator(message, { ns: namespaces, replace: { ...args } })
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

	const { key, args, namespaces } = obj

	if (!key || typeof key !== 'string') {
		return false
	}

	if (args && !checkArgs(args)) {
		return false
	}

	if (namespaces && !Array.isArray(namespaces) && namespaces.find((ns) => typeof ns !== 'string')) {
		return false
	}

	return true
}

function checkArgs(args: any): args is { [key: string]: any } {
	if (args === undefined || args === null) {
		return false
	}

	// this is good enough for object literals and arrays, which is what args can be
	return args.constructor === Object || Array.isArray(args)
}
