import { AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'

export namespace AsRunLogSecurity {
	export function allowReadAccess(selector: object, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}

// Setup rules:
AsRunLog.allow({
	insert(userId: string, doc: AsRunLogEvent): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
