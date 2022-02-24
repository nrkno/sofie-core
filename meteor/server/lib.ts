import process from 'process'
import * as _ from 'underscore'
import fs from 'fs'
import path from 'path'
import { logger } from './logging'

export function getAbsolutePath(): string {
	// @ts-ignore Meteor.absolutePath is injected by the package ostrio:meteor-root
	return Meteor.absolutePath
}
export function extractFunctionSignature(f: Function): string[] | undefined {
	if (f) {
		const str = f.toString() || ''

		const m = str.match(/\(([^)]*)\)/)
		if (m) {
			const params = m[1].split(',')
			return _.map(params, (p) => {
				return p.trim()
			})
		}
	}
}

export type Translations = Record<string, string>

// The /public directory in a Meteor app
const public_dir = path.join(process.cwd(), '../web.browser/app')

/**
 * Get the i18next locale object for a given `languageCode`. If the translations file can not be found or it can't be
 * parsed, it will return an empty object.
 *
 * @export
 * @param {string} languageCode
 * @return {*}  {Promise<Translations>}
 */
export async function getLocale(languageCode: string): Promise<Translations> {
	const localePath = path.join(public_dir, 'locales', languageCode, 'translations.json')
	if (localePath.indexOf(path.join(public_dir, 'locales')) !== 0) {
		logger.error(localePath)
		return {}
	}

	try {
		const file = await fs.promises.readFile(localePath, {
			encoding: 'utf-8',
		})
		return JSON.parse(file)
	} catch (e) {
		logger.error(`getLocale: Error when trying to read file "${localePath}": ${e}`)
	}

	return {}
}
