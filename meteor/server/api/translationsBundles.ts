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
import { Mongocursor } from '../../lib/typings/meteor'

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

		const _id = getExistingId(originBlueprintId, language) || createBundleId(originBlueprintId, language)

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

function createBundleId(blueprintId: BlueprintId, language: string): TranslationsBundleId {
	return protectString<TranslationsBundleId>(getHash(`TranslationsBundle${blueprintId}${language}`))
}

function getExistingId(originBlueprintId: BlueprintId, language: string): TranslationsBundleId | null {
	const bundle = TranslationsBundleCollection.findOne({ originBlueprintId, language })

	return bundle?._id ?? null
}

/**
 * Retrieves a bundle from the database
 *
 * @param bundleId the id of the bundle to retrieve
 * @returns the bundle with the given id
 * @throws if there is no bundle with the given id
 */
export function getBundle(bundleId: TranslationsBundleId) {
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
