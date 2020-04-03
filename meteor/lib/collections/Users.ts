import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'

/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>


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
			verified: false
		}
	],
	profile: {
		name: string
	}

}

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users: TransformedCollection<DBUser, DBUser> = Meteor.users as any
registerCollection('Users', Users)

/** Returns the currently logged in user, or null if not logged in */
export function getUser (): DBUser | null {
	return Meteor.user() as any // as any because the Meteor typings are wrong
}
