import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'

export namespace TimelineSecurity {
	export function allowReadAccess(selector: object, token: string, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}

// Setup rules:
Timeline.allow({
	insert(userId: string, doc: TimelineObjGeneric): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
