import { RuntimeFunctionDebugData, RuntimeFunctionDebugDataObj } from '../../lib/collections/RuntimeFunctionDebugData'

// Setup rules:

RuntimeFunctionDebugData.allow({
	insert (userId: string, doc: RuntimeFunctionDebugDataObj): boolean {
		return false // Not allowed client-side
	},
	update (userId, doc, fields, modifier) {
		return true
	},
	remove (userId, doc) {
		return true
	}
})
