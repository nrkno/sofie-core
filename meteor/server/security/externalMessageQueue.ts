import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'

// Setup rules:
ExternalMessageQueue.allow({
	insert(userId: string, doc: ExternalMessageQueueObj): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
