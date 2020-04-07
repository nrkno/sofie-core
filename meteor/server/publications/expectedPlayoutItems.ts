import * as _ from 'underscore'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { ExpectedPlayoutItemsSecurity } from '../security/collections/expectedPlayoutItems'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.expectedPlayoutItems, (selector, token) => {
	const allowed = ExpectedPlayoutItemsSecurity.allowReadAccess(selector, token, this)
	if (allowed === true) {
		return ExpectedPlayoutItems.find(selector)
	} else if (typeof allowed === 'object') {
		return ExpectedPlayoutItems.find(_.extend(selector, {
			studioId: allowed.studioId
		}))
	}
	return null
})
