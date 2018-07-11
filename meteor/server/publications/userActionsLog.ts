import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { UserActionsLogSecurity } from '../security/userActionsLog'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'

Meteor.publish('userActionsLog', (selector) => {
	if (UserActionsLogSecurity.allowReadAccess({}, this)) {
		return UserActionsLog.find(selector)
	}
	return this.ready()
})
