import { UserProfile } from '../../lib/collections/Users'

export interface NewUserAPI {
	createUser (email: string, password: string, profile: UserProfile): Promise<void>
	removeUser (): Promise<boolean>
}

export enum UserAPIMethods {
	'createUser' = 'user.createUser',
	'removeUser' = 'user.removeUser'
}