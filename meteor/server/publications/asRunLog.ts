import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { AsRunLog } from '../../lib/collections/AsRunLog'
import { AsRunLogSecurity } from '../security/asRunLog'

Meteor.publish('asRunLog', (selector) => {
	if (AsRunLogSecurity.allowReadAccess({}, this)) {
		return AsRunLog.find(selector)
	}
	return this.ready()
})
