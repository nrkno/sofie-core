import { Meteor } from 'meteor/meteor'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'

// Setup rules:
ShowStyleVariants.allow({
	insert (userId: string, doc: ShowStyleVariant): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		if (fields.indexOf('showStyleBaseId') !== -1) return false
		return true
	},
	remove (userId, doc) {
		return false
	}
})
