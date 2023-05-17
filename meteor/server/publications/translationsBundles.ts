import { Meteor } from 'meteor/meteor'

import { TranslationsBundlesSecurity } from '../security/translationsBundles'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { TranslationsBundles } from '../collections'

meteorPublish(PubSub.translationsBundles, async (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')

	if (TranslationsBundlesSecurity.allowReadAccess(selector, token, this)) {
		return TranslationsBundles.findWithCursor(selector, {
			fields: {
				data: 0,
			},
		})
	}

	return null
})
