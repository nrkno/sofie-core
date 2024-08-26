import { Meteor } from 'meteor/meteor'

export class Accounts {
	public static changePassword(
		_oldPassword: string,
		_password: string,
		_callback: (error: Error | null) => void
	): void {
		// nocommit not implemented
		throw new Error('Not implemented')
	}

	public static createUser(
		// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
		_options: any,
		_callback?: (error?: Error | Meteor.Error | Meteor.TypedError) => void
	): string {
		// nocommit not implemented
		throw new Error('Not implemented')
	}

	public static resetPassword(
		_token: string,
		_newPassword: string,
		_callback?: (error?: Error | Meteor.Error | Meteor.TypedError) => void
	): void {
		// nocommit not implemented
		throw new Error('Not implemented')
	}

	public static verifyEmail(
		_token: string,
		_callback?: (error?: Error | Meteor.Error | Meteor.TypedError) => void
	): void {
		// nocommit not implemented
		throw new Error('Not implemented')
	}

	public static loginWithPassword(
		_user: { username: string } | { email: string } | { id: string } | string,
		_password: string,
		_callback?: (error?: Error | Meteor.Error | Meteor.TypedError) => void
	): void {
		// nocommit not implemented
		throw new Error('Not implemented')
	}

	public static async createUserAsync(_options: {
		username?: string | undefined
		email?: string | undefined
		password?: string | undefined
		profile?: unknown | undefined
	}): Promise<string> {
		// nocommit not implemented
		throw new Error('Not implemented')
	}
}
