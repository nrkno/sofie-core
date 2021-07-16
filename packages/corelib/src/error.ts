import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

export enum UserErrorMessage {
	InternalError,
	InactiveRundown,
	DuringHold,
	NoCurrentPart,
	AdlibCurrentPart,
	AdlibNotFound,
	AdlibUnplayable,
	PieceAsAdlibNotFound,
	PieceAsAdlibWrongType,
	PieceAsAdlibCurrentlyLive,
	SourceLayerNotSticky,
	SourceLayerStickyNothingFound,
	BucketAdlibIncompatible,
}

const UserErrorMessagesTranslations: { [key in UserErrorMessage]: string } = {
	[UserErrorMessage.InternalError]: t(`An internal error occured!`),
	[UserErrorMessage.InactiveRundown]: t(`Rundown must be active!`),
	[UserErrorMessage.DuringHold]: t(`Can not be used during a hold!`),
	[UserErrorMessage.NoCurrentPart]: t(`Rundown must be playing!`),
	[UserErrorMessage.AdlibCurrentPart]: t(`AdLibs can be only placed in a currently playing part!`),
	[UserErrorMessage.AdlibNotFound]: t(`AdLib could not be found!`),
	[UserErrorMessage.AdlibUnplayable]: t(`Cannot take unplayable AdLib`),
	[UserErrorMessage.PieceAsAdlibNotFound]: t(`Piece to take was not found!`),
	[UserErrorMessage.PieceAsAdlibWrongType]: t(`Piece to take is not of a 'LOWER_THIRD' item!`),
	[UserErrorMessage.PieceAsAdlibCurrentlyLive]: t(`Piece to take is already live!`),
	[UserErrorMessage.SourceLayerNotSticky]: t(`Layer does not allow sticky pieces!`),
	[UserErrorMessage.SourceLayerStickyNothingFound]: t(`Nothing was found on layer!`),
	[UserErrorMessage.BucketAdlibIncompatible]: t(`Bucket AdLib is not compatible with this Rundown!`),
}

export class UserError {
	private constructor(public readonly rawError: Error, public readonly message: ITranslatableMessage) {
		// super()
	}

	/** Create a UserError with a custom error for the log */
	static from(err: Error, key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		return new UserError(err, { key: UserErrorMessagesTranslations[key], args })
	}

	/** Create a UserError duplicating the same error for the log */
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
