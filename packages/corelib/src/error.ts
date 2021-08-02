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
	NoCurrentOrNextPart,
	AdlibCurrentPart,
	AdlibNotFound,
	AdlibUnplayable,
	PieceAsAdlibNotFound,
	PieceAsAdlibWrongType,
	PieceAsAdlibCurrentlyLive,
	SourceLayerNotSticky,
	SourceLayerStickyNothingFound,
	BucketAdlibIncompatible,
	TakeDuringTransition,
	TakeCloseToAutonext,
	HoldNotCancelable,
	HoldNeedsNextPart,
	HoldAlreadyActive,
	HoldIncompatibleParts,
	HoldAfterAdlib,
	RundownAlreadyActive,
	RundownAlreadyActiveNames,
	RundownResetWhileActive,
	PartNotFound,
	PartNotPlayable,
	ActionsNotSupported,
	TakeNoNextPart,
	TakeRateLimit,
}

const UserErrorMessagesTranslations: { [key in UserErrorMessage]: string } = {
	[UserErrorMessage.InternalError]: t(`An internal error occured!`),
	[UserErrorMessage.InactiveRundown]: t(`Rundown must be active!`),
	[UserErrorMessage.DuringHold]: t(`Can not be used during a hold!`),
	[UserErrorMessage.NoCurrentPart]: t(`Rundown must be playing!`),
	[UserErrorMessage.NoCurrentOrNextPart]: t(`Rundown must be playing or have a next!`),
	[UserErrorMessage.AdlibCurrentPart]: t(`AdLibs can be only placed in a currently playing part!`),
	[UserErrorMessage.AdlibNotFound]: t(`AdLib could not be found!`),
	[UserErrorMessage.AdlibUnplayable]: t(`Cannot take unplayable AdLib`),
	[UserErrorMessage.PieceAsAdlibNotFound]: t(`Piece to take was not found!`),
	[UserErrorMessage.PieceAsAdlibWrongType]: t(`Piece to take is not of a 'LOWER_THIRD' item!`),
	[UserErrorMessage.PieceAsAdlibCurrentlyLive]: t(`Piece to take is already live!`),
	[UserErrorMessage.SourceLayerNotSticky]: t(`Layer does not allow sticky pieces!`),
	[UserErrorMessage.SourceLayerStickyNothingFound]: t(`Nothing was found on layer!`),
	[UserErrorMessage.BucketAdlibIncompatible]: t(`Bucket AdLib is not compatible with this Rundown!`),
	[UserErrorMessage.TakeDuringTransition]: t(`Cannot take during a transition`),
	[UserErrorMessage.TakeCloseToAutonext]: t(`Cannot take close to an AUTO`),
	[UserErrorMessage.HoldNotCancelable]: t(`Cannot cancel HOLD once it has been taken`),
	[UserErrorMessage.HoldNeedsNextPart]: t(`Cannot activate HOLD before a part has been taken!`),
	[UserErrorMessage.HoldAlreadyActive]: t(`Rundown is already doing a HOLD!`),
	[UserErrorMessage.HoldIncompatibleParts]: t(`Cannot activate HOLD between the current and next parts`),
	[UserErrorMessage.HoldAfterAdlib]: t(`Cannot activate HOLD once an adlib has been used`),
	[UserErrorMessage.RundownAlreadyActive]: t(
		`Rundown Playlist is active, please deactivate before preparing it for broadcast`
	),
	[UserErrorMessage.RundownAlreadyActiveNames]: t(
		`Only one rundown can be active at the same time. Currently active rundowns: {{names}}`
	),
	[UserErrorMessage.RundownResetWhileActive]: t(
		`RundownPlaylist is active but not in rehearsal, please deactivate it or set in in rehearsal to be able to reset it.`
	),
	[UserErrorMessage.PartNotFound]: t(`The selected part does not exist`),
	[UserErrorMessage.PartNotPlayable]: t(`The selected part cannot be played`),
	[UserErrorMessage.ActionsNotSupported]: t(`AdLib Actions are not supported in the current Rundown`),
	[UserErrorMessage.TakeNoNextPart]: t(`No Next point found, please set a part as Next before doing a TAKE.`),
	[UserErrorMessage.TakeRateLimit]: t(`Ignoring TAKES that are too quick after eachother ({{duration}} ms)`),
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
