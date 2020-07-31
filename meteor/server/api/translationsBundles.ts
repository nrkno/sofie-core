import { TranslationsBundles, TranslationsBundleId } from '../../lib/collections/TranslationsBundles'
import { TranslationsBundle, TranslationsBundleType } from 'tv-automation-sofie-blueprints-integration'
import { getRandomId } from '../../lib/lib'
import { logger } from '../logging'

export function upsertBundles(bundles: TranslationsBundle[]) {
	for (const bundle of bundles) {
		const { type, namespace, language, data } = bundle

		if (type !== TranslationsBundleType.I18NEXT) {
			throw new Error(`Unknown bundle type ${type}`)
		}

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
				const bundles = dbCursor.fetch()
				logger.debug(`${availableBundles} bundles in database:`, { bundles })
			}
		)
	}
}

function getExistingId(namespace: string | undefined, language: string): TranslationsBundleId | null {
	const bundle = TranslationsBundles.findOne({ namespace, language })

	return bundle ? bundle._id : null
}
