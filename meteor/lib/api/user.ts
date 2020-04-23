export interface NewUserAPI {
	removeUser (): Promise<boolean>
}

export enum UserAPIMethods {
	'removeUser' = 'user.removeUser',
}