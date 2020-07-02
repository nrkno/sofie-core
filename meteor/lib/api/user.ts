import { UserProfile, UserId } from '../../lib/collections/Users'

export interface NewUserAPI {
	createUser(email: string, password: string, profile: UserProfile, enroll?: boolean): Promise<UserId>
	requestPasswordReset(email: string): Promise<boolean>
	removeUser(): Promise<boolean>
}

export enum UserAPIMethods {
	'createUser' = 'user.createUser',
	'requestPasswordReset' = 'user.requestPasswordReset',
	'removeUser' = 'user.removeUser',
}
