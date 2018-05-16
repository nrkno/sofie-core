import { Meteor } from 'meteor/meteor'

import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { StudioInstallationsSecurity } from '../security/studioInstallations'

Meteor.publish('studioInstallations', (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	console.log('pub studioInstallations')
	if (StudioInstallationsSecurity.allowReadAccess(selector, token, this)) {
		return StudioInstallations.find(selector, modifier)
	}
	return this.ready()
})
