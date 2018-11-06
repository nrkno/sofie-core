import { Meteor } from 'meteor/meteor'

import { ShowBlueprints } from '../../lib/collections/ShowBlueprints'
import { ShowBlueprintsSecurity } from '../security/showBlueprints'

Meteor.publish('showBlueprints', (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (ShowBlueprintsSecurity.allowReadAccess(selector, token, this)) {
		return ShowBlueprints.find(selector, modifier)
	}
	return this.ready()
})
