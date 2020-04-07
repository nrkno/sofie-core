import { UserActionsLogSecurity } from '../security/collections/userActionsLog'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.userActionsLog, (selector) => {
	if (UserActionsLogSecurity.allowReadAccess({}, this)) {
		return UserActionsLog.find(selector)
	}
	return null
})
