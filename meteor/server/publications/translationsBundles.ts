import { meteorPublish } from './lib/lib.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { TranslationsBundles } from '../collections/index.js'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify.js'

meteorPublish(MeteorPubSub.translationsBundles, async (_token: string | undefined) => {
	const selector: MongoQuery<TranslationsBundle> = {}

	triggerWriteAccessBecauseNoCheckNecessary()

	return TranslationsBundles.findWithCursor(selector, {
		fields: {
			data: 0,
		},
	})
})
