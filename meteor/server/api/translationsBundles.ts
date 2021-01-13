import { TranslationsBundles, TranslationsBundleId } from '../../lib/collections/TranslationsBundles'
import { TranslationsBundle, TranslationsBundleType } from '@sofie-automation/blueprints-integration'
import { getRandomId, unprotectString } from '../../lib/lib'
import { logger } from '../logging'
import { BlueprintId } from '../../lib/collections/Blueprints'

export function upsertBundles(bundles: TranslationsBundle[], parentBlueprintId: BlueprintId) {
	for (const bundle of bundles) {
		const { type, language, data } = bundle

		if (type !== TranslationsBundleType.I18NEXT) {
			throw new Error(`Unknown bundle type ${type}`)
		}

		const namespace = unprotectString(parentBlueprintId)
		const _id = getExistingId(namespace, language) || getRandomId<'TranslationsBundleId'>()

		TranslationsBundles.upsert(
			_id,
			{ _id, type, namespace, language, data },
			{ multi: false },
			(
				err: Error,
				{ numberAffected, insertedId }: { numberAffected: number; insertedId?: TranslationsBundleId }
			) => {
				if (!err && numberAffected) {
					logger.info(`Stored translation bundle ([${insertedId || _id}]:${namespace}:${language})`)
				} else {
					logger.error(`Unable to store translation bundle ([${_id}]:${namespace}:${language})`, {
						error: err,
					})
				}
				const dbCursor = TranslationsBundles.find({})
				const availableBundles = dbCursor.count()
				const bundles = dbCursor.fetch().map(({ _id, namespace, language }) => ({ _id, namespace, language }))
				logger.debug(`${availableBundles} bundles in database:`, { bundles })
			}
		)
	}
}

function getExistingId(namespace: string | undefined, language: string): TranslationsBundleId | null {
	const bundle = TranslationsBundles.findOne({ namespace, language })

	return bundle ? bundle._id : null
}
