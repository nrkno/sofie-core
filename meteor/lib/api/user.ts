import { Accounts } from 'meteor/accounts-base'
import { UserProfile } from '../../lib/collections/Users'
import { protectString } from '../lib'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewUserAPI {
	enrollUser(email: string, name: string): Promise<UserId>
	requestPasswordReset(email: string): Promise<boolean>
	removeUser(): Promise<boolean>
}
export enum UserAPIMethods {
	'enrollUser' = 'user.enrollUser',
	'requestPasswordReset' = 'user.requestPasswordReset',
	'removeUser' = 'user.removeUser',
}

export interface CreateNewUserData {
	email: string
	profile: UserProfile
	password?: string
	createOrganization?: {
		name: string
		applications: string[]
		broadcastMediums: string[]
	}
}
export async function createUser(newUser: CreateNewUserData): Promise<UserId> {
	// This is available both client-side and server side.
	// The reason for that is that the client-side should use Accounts.createUser right away
	// so that the password aren't sent in "plaintext" to the server.

	const userId = await Accounts.createUserAsync(newUser)
	return protectString<UserId>(userId)
}
