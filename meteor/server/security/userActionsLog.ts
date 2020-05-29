import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'

export namespace UserActionsLogSecurity {
	export function allowReadAccess(selector: object, context: any) {
		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess() {
		// TODO
	}
}

// Setup rules:
UserActionsLog.allow({
	insert(userId: string, doc: UserActionsLogItem): boolean {
		return false
	},
	update(userId, doc, fields, modifier) {
		return false
	},
	remove(userId, doc) {
		return false
	},
})
