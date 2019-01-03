import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedMediaItemsSecurity } from '../security/expectedMediaItems'
import { logger } from '../logging'

Meteor.publish('expectedMediaItems', (selector, token) => {
	if (ExpectedMediaItemsSecurity.allowReadAccess(selector, token, this)) {
		return ExpectedMediaItems.find(selector)
	}
	return this.ready()
})
