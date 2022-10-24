import { Meteor } from 'meteor/meteor'
import { Credentials, resolveAuthenticatedUser, resolveCredentials } from './lib/credentials'
import { logNotAllowed } from './lib/lib'
import { allowAccessToCoreSystem, allowAccessToCurrentUser, allowAccessToSystemStatus } from './lib/security'
import { Settings } from '../../lib/Settings'
import { triggerWriteAccess } from './lib/securityVerify'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export namespace SystemReadAccess {
	/** Handles read access for all organization content (segments, parts, pieces etc..) */
	export async function coreSystem(cred0: Credentials): Promise<boolean> {
		const cred = await resolveCredentials(cred0)

		const access = await allowAccessToCoreSystem(cred)
		if (!access.read) return logNotAllowed('CoreSystem', access.reason)

		return true
	}
	/** Check if access is allowed to read a User, and that user is the current User */
	export async function currentUser(userId: UserId, cred: Credentials): Promise<boolean> {
		const access = await allowAccessToCurrentUser(cred, userId)
		if (!access.read) return logNotAllowed('Current user', access.reason)

		return true
	}
	/** Check permissions to get the system status */
	export async function systemStatus(cred0: Credentials): Promise<boolean> {
		// For reading only
		triggerWriteAccess()
		const access = await allowAccessToSystemStatus(cred0)
		if (!access.read) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return true
	}
}
export namespace SystemWriteAccess {
	// These functions throws if access is not allowed.

	export async function coreSystem(cred0: Credentials): Promise<boolean> {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) return true
		const cred = await resolveAuthenticatedUser(cred0)
		if (!cred) throw new Meteor.Error(403, `Not logged in`)

		const access = await allowAccessToCoreSystem(cred)
		if (!access.configure) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return true
	}
	/** Check if access is allowed to modify a User, and that user is the current User */
	export async function currentUser(userId: UserId, cred: Credentials): Promise<boolean> {
		const access = await allowAccessToCurrentUser(cred, userId)
		if (!access.update) return logNotAllowed('Current user', access.reason)

		return true
	}
	/** Check permissions to run migrations of all types */
	export async function migrations(cred0: Credentials): Promise<boolean> {
		return coreSystem(cred0)
	}
	/** Check permissions to perform a system-level action */
	export async function systemActions(cred0: Credentials): Promise<boolean> {
		return coreSystem(cred0)
	}
}
