import * as _ from 'underscore'
import { CoreSystem, ICoreSystem } from '../../lib/collections/CoreSystem'

// Setup rules:
CoreSystem.allow({
	insert(userId: string, doc: ICoreSystem): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		if (_.difference(fields, ['support', 'systemInfo', 'name']).length === 0) {
			return true
		}
		return false
	},
	remove(userId, doc) {
		return false
	},
})
