import { Meteor } from 'meteor/meteor'

import { TranslationsBundlesSecurity } from '../security/translationsBundles'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { TranslationsBundles } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'

meteorPublish(
	PubSub.translationsBundles,
	async (selector: MongoQuery<TranslationsBundle>, token: string | undefined) => {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')

		if (TranslationsBundlesSecurity.allowReadAccess(selector, token, this)) {
			return TranslationsBundles.findWithCursor(selector, {
				fields: {
					data: 0,
				},
			})
		}

		return null
	}
)
