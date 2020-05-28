import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'
import { OrganizationId } from './Organization'

/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>

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
	},
	username: string
	emails: [
		{
			address: string
			verified: boolean
		}
	],
	profile: UserProfile,
	organizationId: OrganizationId
	roles: UserRole[]
	superAdmin?: boolean
}
export interface UserRole {
	type: UserRoleType
}
export enum UserRoleType {
	/** Can play out things in a studio */
	STUDIO_PLAYOUT = 'studio_playout',
	/** Can access and modify the settings */
	CONFIGURATOR = 'configurator',
	/** Can enable devloper features including test tools */
	DEVELOPER = 'developer'
}

export type User = DBUser // to be replaced by a class somet ime later?

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users: TransformedCollection<User, DBUser> = Meteor.users as any
registerCollection('Users', Users)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Users._ensureIndex({
			organizationId: 1
		})
	}
})


/** Returns the currently logged in user, or null if not logged in */
export function getUser (): DBUser | null {
	const user = Meteor.user() as any
	return user
}
export function getUserId (): UserId | null {
	return Meteor.userId() as any || null
}
