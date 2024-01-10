import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Accounts } from 'meteor/accounts-base'
import { unprotectString, protectString, deferAsync, sleep } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewUserAPI, UserAPIMethods, createUser, CreateNewUserData } from '../../lib/api/user'
import { registerClassToMeteorMethods } from '../methods'
import { SystemWriteAccess } from '../security/system'
import { triggerWriteAccess, triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { logNotAllowed } from '../../server/security/lib/lib'
import { User } from '../../lib/collections/Users'
import { createOrganization } from './organizations'
import { DBOrganizationBase } from '../../lib/collections/Organization'
import { resetCredentials } from '../security/lib/credentials'
import { OrganizationId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Organizations, Users } from '../collections'
import { logger } from '../logging'

async function enrollUser(email: string, name: string): Promise<UserId> {
	triggerWriteAccessBecauseNoCheckNecessary()

	const id = await createUser({
		email: email,
		profile: { name: name },
	})
	try {
		Accounts.sendEnrollmentEmail(unprotectString(id), email)
	} catch (error) {
		logger.error('Accounts.sendEnrollmentEmail')
		logger.error(error)
	}

	return id
}

async function afterCreateNewUser(userId: UserId, organization: DBOrganizationBase): Promise<OrganizationId> {
	triggerWriteAccessBecauseNoCheckNecessary()

	await sendVerificationEmail(userId)

	// Create an organization for the user:
	const orgId = await createOrganization(organization)
	// Add user to organization:
	await Users.updateAsync(userId, { $set: { organizationId: orgId } })
	await Organizations.updateAsync(orgId, {
		$set: {
			userRoles: {
				[unprotectString(userId)]: {
					admin: true,
					studio: true,
					configurator: true,
				},
			},
		},
	})

	resetCredentials({ userId })

	return orgId
}
async function sendVerificationEmail(userId: UserId) {
	const user = await Users.findOneAsync(userId)
	if (!user) throw new Meteor.Error(404, `User "${userId}" not found!`)
	try {
		_.each(user.emails, (email) => {
			if (!email.verified) {
				Accounts.sendVerificationEmail(unprotectString(user._id), email.address)
			}
		})
	} catch (error) {
		logger.error('ERROR sending email verification')
		logger.error(error)
	}
}

async function requestResetPassword(email: string): Promise<boolean> {
	triggerWriteAccessBecauseNoCheckNecessary()
	const meteorUser = Accounts.findUserByEmail(email) as unknown
	const user = meteorUser as User
	if (!user) return false
	Accounts.sendResetPasswordEmail(unprotectString(user._id))
	return true
}

async function removeUser(context: MethodContext) {
	triggerWriteAccess()
	if (!context.userId) throw new Meteor.Error(403, `Not logged in`)
	const access = await SystemWriteAccess.currentUser(context.userId, context)
	if (!access) return logNotAllowed('Current user', 'Invalid user id or permissions')
	await Users.removeAsync(context.userId)
	return true
}

class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	async enrollUser(email: string, name: string) {
		return enrollUser(email, name)
	}
	async requestPasswordReset(email: string) {
		return requestResetPassword(email)
	}
	async removeUser() {
		return removeUser(this)
	}
}

registerClassToMeteorMethods(UserAPIMethods, ServerUserAPI, false)

Accounts.onCreateUser((options0, user) => {
	const options = options0 as Partial<CreateNewUserData>
	user.profile = options.profile

	const createOrganization = options.createOrganization
	if (createOrganization) {
		deferAsync(async () => {
			// To be run after the user has been inserted:
			for (let t = 10; t < 200; t *= 1.5) {
				const dbUser = await Users.findOneAsync(protectString(user._id))
				if (dbUser) {
					await afterCreateNewUser(dbUser._id, createOrganization)
					return
				} else {
					// User has not been inserted into db (yet), wait
					await sleep(t)
				}
			}
		})
	}
	// The user to-be-inserted:
	return user
})
