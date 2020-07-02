import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Accounts } from 'meteor/accounts-base'
import { literal, getRandomId, makePromise, getCurrentTime, unprotectString, protectString } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewUserAPI, UserAPIMethods } from '../../lib/api/user'
import { registerClassToMeteorMethods } from '../methods'
import { SystemReadAccess, SystemWriteAccess } from '../security/system'
import { triggerWriteAccess, triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { resolveCredentials } from '../security/lib/credentials'
import { logNotAllowed } from '../../server/security/lib/lib'
import { UserProfile, User } from '../../lib/collections/Users'

export function createUser(email: string, password: string, profile: UserProfile, enroll?: boolean) {
	triggerWriteAccessBecauseNoCheckNecessary()
	const id = Accounts.createUser({
		email: email,
		password: password,
		profile: profile,
	})
	if (!id) throw new Meteor.Error(500, 'Error creating user account')
	if (Meteor.settings.MAIL_URL) {
		if (enroll) {
			try {
				Accounts.sendEnrollmentEmail(id, email)
			} catch (error) {
				console.error('ERROR sending email enrollment', error)
			}
		} else {
			try {
				Accounts.sendVerificationEmail(id, email)
			} catch (error) {
				console.error('ERROR sending email verification', error)
			}
		}
	}

	return protectString(id)
}

export function requestResetPassword(email: string): boolean {
	triggerWriteAccessBecauseNoCheckNecessary()
	const meteorUser = Accounts.findUserByEmail(email) as unknown
	const user = meteorUser as User
	if (!user) return false
	Accounts.sendResetPasswordEmail(unprotectString(user._id))
	return true
}

export function removeUser(context: MethodContext) {
	triggerWriteAccess()
	if (!context.userId) throw new Meteor.Error(403, `Not logged in`)
	const access = SystemWriteAccess.currentUser(context.userId, context)
	if (!access) return logNotAllowed('Current user', 'Invalid user id or permissions')
	Meteor.users.remove(context.userId)
	return true
}

class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	createUser(email: string, password: string, profile: UserProfile, enroll?: boolean) {
		return makePromise(() => createUser(email, password, profile, enroll))
	}
	requestPasswordReset(email: string) {
		return makePromise(() => requestResetPassword(email))
	}
	removeUser() {
		return makePromise(() => removeUser(this))
	}
}

registerClassToMeteorMethods(UserAPIMethods, ServerUserAPI, false)
