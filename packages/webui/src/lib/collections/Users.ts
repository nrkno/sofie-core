import { Meteor } from 'meteor/meteor'
import { unprotectString } from '../lib'
import { UserRoles, DBOrganization } from './Organization'
import { UserId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Organizations } from '../collections/libCollections'

export interface UserProfile {
	name: string
}

export interface DBUser {
	// Note: This interface is partly defined by the dataset from the Meteor.users collection

	_id: UserId
	createdAt: string
	services: {
		password: {
			bcrypt: string
		}
	}
	username: string
	emails: [
		{
			address: string
			verified: boolean
		}
	]
	profile: UserProfile
	organizationId: OrganizationId
	superAdmin?: boolean
}

export type User = DBUser // to be replaced by a class somet ime later?

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
