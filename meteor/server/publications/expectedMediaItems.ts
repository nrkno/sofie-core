import * as _ from 'underscore'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedMediaItemsSecurity } from '../security/expectedMediaItems'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.expectedMediaItems, (selector, token) => {
	const allowed = ExpectedMediaItemsSecurity.allowReadAccess(selector, token, this)
	if (allowed === true) {
		return ExpectedMediaItems.find(selector)
	} else if (typeof allowed === 'object') {
		return ExpectedMediaItems.find(
			_.extend(selector, {
				studioId: allowed.studioId,
			})
		)
	}
	return null
})
