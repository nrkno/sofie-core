import { AsRunLog } from '../../lib/collections/AsRunLog'
import { AsRunLogSecurity } from '../security/collections/asRunLog'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.asRunLog, (selector) => {
	if (AsRunLogSecurity.allowReadAccess({}, this)) {
		return AsRunLog.find(selector)
	}
	return null
})
