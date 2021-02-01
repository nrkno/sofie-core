import {
	TranslationsBundles as TranslationsBundleCollection,
	TranslationsBundleId,
	Translation,
	TranslationsBundle as DBTranslationsBundle,
} from '../../lib/collections/TranslationsBundles'
import {
	I18NextData,
	TranslationsBundle as BlueprintTranslationsbundle,
	TranslationsBundleType,
} from '@sofie-automation/blueprints-integration'
import { getRandomId, unprotectString } from '../../lib/lib'
import { logger } from '../logging'
import { BlueprintId } from '../../lib/collections/Blueprints'
import { Mongocursor } from '../../lib/typings/meteor'

/**
 * Insert or update translation bundles in the database.
 *
 * @param bundles the bundles to insert or update
 * @param parentBlueprintId id of the blueprint the translation bundles belongs to
 */
export function upsertBundles(bundles: BlueprintTranslationsbundle[], parentBlueprintId: BlueprintId) {
	for (const bundle of bundles) {
		const { type, language, data } = bundle

		if (type !== TranslationsBundleType.I18NEXT) {
			throw new Error(`Unknown bundle type ${type}`)
		}

		const namespace = unprotectString(parentBlueprintId)
		const _id = getExistingId(namespace, language) || getRandomId<'TranslationsBundleId'>()

		TranslationsBundleCollection.upsert(
			_id,
			{ _id, type, namespace, language, data: fromI18NextData(data) },
			{ multi: false },
			(err: Error, numberAffected: number) => {
				if (!err && numberAffected) {
					logger.info(`Stored${_id ? '' : ' new '}translation bundle :${namespace}:${language})`)
				} else {
					logger.error(`Unable to store translation bundle ([${_id}]:${namespace}:${language})`, {
						error: err,
					})
				}
				const dbCursor = TranslationsBundleCollection.find({})
				logger.debug(`${dbCursor.count()} bundles in database:`, { bundles: fetchAvailableBundles(dbCursor) })
			}
		)
	}
}

function getExistingId(namespace: string | undefined, language: string): TranslationsBundleId | null {
	const bundle = TranslationsBundleCollection.findOne({ namespace, language })

	return bundle ? bundle._id : null
}

function fetchAvailableBundles(dbCursor: Mongocursor<{ _id: TranslationsBundleId } & DBTranslationsBundle>) {
	const stuff = dbCursor.fetch()
	return stuff.map(({ namespace, language }) => ({ namespace, language }))
}

/**
 * Convert data from the i18next form which the blueprint type specifies into a format that Mongo accepts.
 *
 * @param data translations on i18next form
 * @returns translations suitable to put into Mongo
 */
function fromI18NextData(data: I18NextData): Translation[] {
	const translations: Translation[] = []
	for (const original in data) {
		translations.push({ original, translation: data[original] })
	}

	return translations
}
