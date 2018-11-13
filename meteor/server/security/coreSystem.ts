import { Meteor } from 'meteor/meteor'
import { CoreSystem, ICoreSystem } from '../../lib/collections/CoreSystem'

// Setup rules:
CoreSystem.allow({
	insert (userId: string, doc: ICoreSystem): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return false
	},
	remove (userId, doc) {
		return false
	}
})
