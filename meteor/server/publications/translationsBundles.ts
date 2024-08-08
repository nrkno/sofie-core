import { TranslationsBundlesSecurity } from '../security/translationsBundles'
import { meteorPublish } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { TranslationsBundles } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'

meteorPublish(MeteorPubSub.translationsBundles, async (token: string | undefined) => {
	const selector: MongoQuery<TranslationsBundle> = {}

	if (TranslationsBundlesSecurity.allowReadAccess(selector, token, this)) {
		return TranslationsBundles.findWithCursor(selector, {
			fields: {
				data: 0,
			},
		})
	}

	return null
})
