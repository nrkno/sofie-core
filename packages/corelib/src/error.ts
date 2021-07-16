import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

export enum UserErrorMessage {
	InternalError,
	AdlibInactiveRundown,
	AdlibDuringHold,
	AdlibCurrentPart,
	AdlibNotFound,
}

const UserErrorMessagesTranslations: { [key in UserErrorMessage]: string } = {
	[UserErrorMessage.InternalError]: t(`An internal error occured!`),
	[UserErrorMessage.AdlibInactiveRundown]: t(`AdLibs can be only placed in an active rundown!`),
	[UserErrorMessage.AdlibDuringHold]: t(`AdLibs can not be used in combination with hold!`),
	[UserErrorMessage.AdlibCurrentPart]: t(`AdLibs can be only placed in a currently playing part!`),
	[UserErrorMessage.AdlibNotFound]: t(`AdLib could not be found!`),
}

export class UserError {
	private constructor(public readonly rawError: Error, public readonly message: ITranslatableMessage) {
		// super()
	}

	static from(err: Error, key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		return new UserError(err, { key: UserErrorMessagesTranslations[key], args })
	}

	static create(key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		return UserError.from(new Error(UserErrorMessagesTranslations[key]), key, args)
	}

	static tryFromJSON(str: string): UserError {
		const p = JSON.parse(str)
		if (UserError.isUserError(p)) {
			return new UserError(new Error(p.rawError.toString()), p.message)
		} else {
			throw new Error('Not a UserError')
		}
	}

	static toJSON(e: UserError): string {
		return JSON.stringify({
			rawError: e.rawError.toString(),
			message: e.message,
		})
	}

	static isUserError(e: any): e is UserError {
		return 'rawError' in e && 'message' in e
	}
}
