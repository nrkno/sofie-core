import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { ExpectedMediaItemsSecurity } from '../security/expectedMediaItems'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.expectedMediaItems, (selector, token) => {
	if (ExpectedMediaItemsSecurity.allowReadAccess(selector, token, this)) {
		return ExpectedMediaItems.find(selector)
	}
	return null
})
