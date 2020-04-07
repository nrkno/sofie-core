import { ShowStyleVariant, ShowStyleVariants } from '../../../lib/collections/ShowStyleVariants'
import { rejectFields } from './lib'

// Setup rules:
ShowStyleVariants.allow({
	insert (userId: string, doc: ShowStyleVariant): boolean {
		return false
	},
	update (userId, doc, fields, modifier) {
		return rejectFields(fields, [
			'showStyleBaseId'
		])
	},
	remove (userId, doc) {
		return false
	}
})
