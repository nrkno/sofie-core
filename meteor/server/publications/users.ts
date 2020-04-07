import { Meteor } from 'meteor/meteor'
import { RundownSecurity } from '../security/collections/rundowns'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Users } from '../../lib/collections/Users'

meteorPublish(PubSub.loggedInUser, function () {
	return Users.find(
		{
			_id: this.userId
		},
		{
			fields: {
				'_id': 1,
				'username': 1,
				'emails': 1,
				'profile': 1
			}
		}
	)
})
