import { Meteor } from 'meteor/meteor'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'

// Setup rules:
ExternalMessageQueue.allow({
	insert (userId: string, doc: ExternalMessageQueueObj): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
