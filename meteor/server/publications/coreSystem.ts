import { Meteor } from 'meteor/meteor'
import { getCoreSystemCursor } from '../../lib/collections/CoreSystem'

Meteor.publish('coreSystem', (selector) => {
	return getCoreSystemCursor()
})
