import { Meteor } from 'meteor/meteor'

import { TranslationsBundles } from '../../lib/collections/TranslationsBundles'
import { TranslationsBundlesSecurity } from '../security/translationsBundles'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.translationsBundles, async (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')

	if (TranslationsBundlesSecurity.allowReadAccess(selector, token, this)) {
		return TranslationsBundles.find(selector, {
			fields: {
				data: 0,
			},
		})
	}

	return null
})
