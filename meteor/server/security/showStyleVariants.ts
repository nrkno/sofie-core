import { Meteor } from 'meteor/meteor'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'

// Setup rules:
ShowStyleVariants.allow({
	insert (userId: string, doc: ShowStyleVariant): boolean {
		return true
	},
	update (userId, doc, fields, modifier) {
		return true
	},
	remove (userId, doc) {
		return true
	}
})
