import { RandomMock } from './random'
import { MeteorMock } from './meteor'
import { Accounts } from 'meteor/accounts-base'

export class AccountsBaseMock {
	static mockUsers: any = {}

	// From https://docs.meteor.com/api/passwords.html

	static createUser(
		options: Parameters<typeof Accounts.createUser>[0],
		cb: (err: any | undefined, result?: any) => void
	): void {
		const user = {
			_id: RandomMock.id(),
			...options,
		}
		AccountsBaseMock.mockUsers[user._id] = user
		MeteorMock.setTimeout(() => {
			cb(undefined, user._id)
		}, 1)
		throw new Error('Mocked function not implemented')
	}
	static setUsername(userId: string, newUsername: string): void {
		AccountsBaseMock.mockUsers[userId].username = newUsername
		throw new Error('Mocked function not implemented')
	}
	static removeEmail(_userId: string, _email: string): void {
		throw new Error('Mocked function not implemented')
	}
	static verifyEmail(_token: string, _cb: (err: any | undefined, result?: any) => void): void {
		throw new Error('Mocked function not implemented')
	}
	static findUserByUsername(_username: string): void {
		throw new Error('Mocked function not implemented')
	}
	static findUserByEmail(_email: string): void {
		throw new Error('Mocked function not implemented')
	}
	static changePassword(
		_oldPassword: string,
		_newPassword: string,
		_cb: (err: any | undefined, result?: any) => void
	): void {
		throw new Error('Mocked function not implemented')
	}
	static forgotPassword(
		_options: { email?: string | undefined },
		_cb: (err: any | undefined, result?: any) => void
	): void {
		throw new Error('Mocked function not implemented')
	}
	static resetPassword(
		_token: string,
		_newPassword: string,
		_cb: (err: any | undefined, result?: any) => void
	): void {
		throw new Error('Mocked function not implemented')
	}
	static setPassword(_userId: string, _newPassword: string, _options?: { logout?: Object | undefined }): void {
		throw new Error('Mocked function not implemented')
	}
	static sendResetPasswordEmail(_userId: string, _email: string): void {
		throw new Error('Mocked function not implemented')
	}
	static sendEnrollmentEmail(_userId: string, _email: string): void {
		throw new Error('Mocked function not implemented')
	}
	static sendVerificationEmail(_userId: string, _email: string): void {
		throw new Error('Mocked function not implemented')
	}
	static onResetPasswordLink?: () => void
	static onEnrollmentLink?: () => void
	static onEmailVerificationLink?: () => void
	static emailTemplates?: () => void
}
export function setup(): any {
	return {
		Accounts: AccountsBaseMock,
	}
}
