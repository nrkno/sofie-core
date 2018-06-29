import { Meteor } from 'meteor/meteor'

import { ShowStyles } from '../../lib/collections/ShowStyles'
import { ShowStylesSecurity } from '../security/showStyles'

Meteor.publish('showStyles', (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (ShowStylesSecurity.allowReadAccess(selector, token, this)) {
		return ShowStyles.find(selector, modifier)
	}
	return this.ready()
})
