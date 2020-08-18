import { MeteorMock } from './meteor'
import { RandomMock } from './random'

export class AccountsBaseMock {
	static mockUsers: any = {}

	// From https://docs.meteor.com/api/passwords.html

	static createUser(options, cb: (err: any | undefined, result?: any) => void): void {
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
	static setUsername(userId, newUsername): void {
		AccountsBaseMock.mockUsers[userId].username = newUsername
		throw new Error('Mocked function not implemented')
	}
	static removeEmail(userId, email): void {
		throw new Error('Mocked function not implemented')
	}
	static verifyEmail(token, cb: (err: any | undefined, result?: any) => void): void {
		throw new Error('Mocked function not implemented')
	}
	static findUserByUsername(username, [options]): void {
		throw new Error('Mocked function not implemented')
	}
	static findUserByEmail(email, [options]): void {
		throw new Error('Mocked function not implemented')
	}
	static changePassword(oldPassword, newPassword, cb: (err: any | undefined, result?: any) => void): void {
		throw new Error('Mocked function not implemented')
	}
	static forgotPassword(options, cb: (err: any | undefined, result?: any) => void): void {
		throw new Error('Mocked function not implemented')
	}
	static resetPassword(token, newPassword, cb: (err: any | undefined, result?: any) => void): void {
		throw new Error('Mocked function not implemented')
	}
	static setPassword(userId, newPassword, [options]): void {
		throw new Error('Mocked function not implemented')
	}
	static sendResetPasswordEmail(userId, [email], [extraTokenData]): void {
		throw new Error('Mocked function not implemented')
	}
	static sendEnrollmentEmail(userId, [email], [extraTokenData]): void {
		throw new Error('Mocked function not implemented')
	}
	static sendVerificationEmail(userId, [email], [extraTokenData]): void {
		throw new Error('Mocked function not implemented')
	}
	static onResetPasswordLink?: () => void
	static onEnrollmentLink?: () => void
	static onEmailVerificationLink?: () => void
	static emailTemplates?: () => void

	// loginServicesConfigured()
	// loginServiceConfiguration.find();
}
export function setup() {
	return {
		Accounts: AccountsBaseMock,
	}
}
