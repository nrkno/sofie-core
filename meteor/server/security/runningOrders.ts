import { RunningOrders, RunningOrder } from '../../lib/collections/RunningOrders'

export namespace RunningOrderSecurity {
	export function allowReadAccess (selector: object, token: string, context) {

		return true
		// TODO: implement some security here
	}
	export function allowWriteAccess () {
		// TODO
	}
}
// Setup rules:

RunningOrders.allow({
	insert (userId: string, doc: RunningOrder): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true // tmp!
		return false // Not allowed client-side
	},
	remove (userId, doc) {
		return false // Not allowed client-side
	}
})
