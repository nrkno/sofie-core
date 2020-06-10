import { allowAccessToAnything } from './lib/security'
import { logNotAllowed } from './lib/lib'

export namespace NoSecurityReadAccess {
	export function any() {
		const access = allowAccessToAnything()
		if (!access.read) return false // don't even log anything
		return true
	}
}
