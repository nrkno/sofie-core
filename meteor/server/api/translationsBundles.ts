import { Meteor } from 'meteor/meteor'
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
import { getHash, protectString, unprotectString } from '../../lib/lib'
import { BlueprintId } from '../../lib/collections/Blueprints'

/**
 * Insert or update translation bundles in the database.
 *
 * @param bundles the bundles to insert or update
 * @param originBlueprintId id of the blueprint the translation bundles belongs to
 */
export function upsertBundles(bundles: BlueprintTranslationsbundle[], originBlueprintId: BlueprintId) {
	for (const bundle of bundles) {
		const { type, language, data } = bundle

		if (type !== TranslationsBundleType.I18NEXT) {
			throw new Error(`Unknown bundle type ${type}`)
		}

		// doesn't matter if it's a new or existing bundle, the id will be the same with the same
		// originating blueprint and language
		const _id = createBundleId(originBlueprintId, language)

		TranslationsBundleCollection.upsert(
			_id,
			{
				_id,
				originBlueprintId,
				type,
				namespace: unprotectString(originBlueprintId),
				language,
				data: fromI18NextData(data),
				hash: getHash(JSON.stringify(data)),
			},
			{ multi: false }
		)
	}
}

/**
 * Creates an id for a bundle based on its originating blueprint and language (which are
 * guaranteed to be unique, as there is only one set of translations per language per blueprint).
 * The id hash is guaranteed to be the same for every call with equal input, meaning it can be used
 * to find a previously generated id as well as generating new ids.
 *
 * @param blueprintId the id of the blueprint the translations were bundled with
 * @param language the language the bundle contains translations for
 */
function createBundleId(blueprintId: BlueprintId, language: string): TranslationsBundleId {
	return protectString<TranslationsBundleId>(getHash(`TranslationsBundle${blueprintId}${language}`))
}

/**
 * Retrieves a bundle from the database
 *
 * @param bundleId the id of the bundle to retrieve
 * @returns the bundle with the given id
 * @throws if there is no bundle with the given id
 */
export function getBundle(bundleId: TranslationsBundleId): DBTranslationsBundle {
	const bundle = TranslationsBundleCollection.findOne(bundleId)
	if (!bundle) {
		throw new Meteor.Error(404, `Bundle "${bundleId}" not found`)
	}

	return bundle
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
