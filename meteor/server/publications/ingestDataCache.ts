import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { IngestDataCache, IngestDataCacheObj } from '../../lib/collections/IngestDataCache'
import { FindOptions } from '../../lib/typings/meteor'

// Note: this publication is for dev purposes only (it should probably not be used in production at all)

meteorPublish(PubSub.ingestDataCache, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier: FindOptions<IngestDataCacheObj> = {
		fields: {}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return IngestDataCache.find(selector, modifier)
	}
	return null
})
