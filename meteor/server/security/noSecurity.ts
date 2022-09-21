import { allowAccessToAnythingWhenSecurityDisabled } from './lib/security'

export namespace NoSecurityReadAccess {
	/**
	 * Grant read access if security is disabled
	 */
	export function any(): boolean {
		const access = allowAccessToAnythingWhenSecurityDisabled()
		if (!access.read) return false // don't even log anything
		return true
	}
}
