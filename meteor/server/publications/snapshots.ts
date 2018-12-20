import { Meteor } from 'meteor/meteor'
import { Snapshots } from '../../lib/collections/Snapshots'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.snapshots, (selector) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return Snapshots.find(selector)
})
