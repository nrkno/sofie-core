import { Meteor } from 'meteor/meteor'
import { UserId } from '../../lib/collections/Users'
import { Credentials, resolveAuthenticatedUser, resolveCredentials } from './lib/credentials'
import { logNotAllowed } from './lib/lib'
import { allowAccessToCoreSystem, allowAccessToCurrentUser, allowAccessToSystemStatus } from './lib/security'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccess } from './lib/securityVerify'
import { waitForPromise } from '../../lib/lib'

export namespace SystemReadAccess {
	/** Handles read access for all organization content (segments, parts, pieces etc..) */
	export function coreSystem(cred0: Credentials): boolean {
		const cred = resolveCredentials(cred0)

		const access = allowAccessToCoreSystem(cred)
		if (!access.read) return logNotAllowed('CoreSystem', access.reason)

		return true
	}
	export function currentUser(userId: UserId, cred: Credentials): boolean {
		const access = allowAccessToCurrentUser(cred, userId)
		if (!access.read) return logNotAllowed('Current user', access.reason)

		return true
	}
	export function systemStatus(cred0: Credentials) {
		// For reading only
		triggerWriteAccess()
		const access = allowAccessToSystemStatus(cred0)
		if (!access.read) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return true
	}
}
export namespace SystemWriteAccess {
	// These functions throws if access is not allowed.

	export async function coreSystem(cred0: Credentials) {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) return true
		const cred = await resolveAuthenticatedUser(cred0)
		if (!cred) throw new Meteor.Error(403, `Not logged in`)

		const access = allowAccessToCoreSystem(cred)
		if (!access.configure) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return true
	}
	export function currentUser(userId: UserId, cred: Credentials): boolean {
		const access = allowAccessToCurrentUser(cred, userId)
		if (!access.read) return logNotAllowed('Current user', access.reason)

		return true
	}
	export function migrations(cred0: Credentials) {
		return waitForPromise(coreSystem(cred0))
	}
	export async function systemActions(cred0: Credentials) {
		return coreSystem(cred0)
	}
}
