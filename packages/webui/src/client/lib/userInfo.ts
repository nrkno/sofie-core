import { Meteor } from 'meteor/meteor'
import { UserRoles, DBOrganization } from '@sofie-automation/meteor-lib/dist/collections/Organization'
import { Organizations } from '../../lib/collections/libCollections'
import { User } from '@sofie-automation/meteor-lib/dist/collections/Users'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

/** Returns the currently logged in user, or null if not logged in */
export function getUser(): User | null {
	const user = Meteor.user() as any
	return user
}
export function getUserId(): UserId | null {
	return (Meteor.userId() as any) || null
}
export function getUserRoles(user?: User | null, organization?: DBOrganization | null): UserRoles {
	if (user === undefined) user = getUser()
	if (!user) {
		return {}
	}
	if (organization === undefined) organization = Organizations.findOne({ _id: user.organizationId }) || null
	return getUserRolesFromLoadedDocuments(user, organization)
}

export function getUserRolesFromLoadedDocuments(user: User | null, organization: DBOrganization | null): UserRoles {
	if (!user) {
		return {}
	}
	return (organization?.userRoles && organization.userRoles[unprotectString(user._id)]) || {}
}
