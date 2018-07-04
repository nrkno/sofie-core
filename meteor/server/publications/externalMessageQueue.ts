import { Meteor } from 'meteor/meteor'

import { StudioInstallationsSecurity } from '../security/studioInstallations'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'

Meteor.publish('externalMessageQueue', function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (StudioInstallationsSecurity.allowReadAccess(selector, token, this)) {
		return ExternalMessageQueue.find(selector, modifier)
	}
	return this.ready()
})
