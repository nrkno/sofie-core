import { Meteor } from 'meteor/meteor'
import { Snapshots } from '../../lib/collections/Snapshots'

Meteor.publish('snapshots', (selector) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	return Snapshots.find(selector)
})
