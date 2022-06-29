import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { stringifyError } from './lib'

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

/**
 * List of all possible UserErrorMessages.
 * This is an enum to allow for the strings to be defined in one central location.
 * Note: The Values for these items should never be changed once set. The UI will use these to match certain errors, and the values can be persisted in the database
 */
export enum UserErrorMessage {
	InternalError = 0,
	InactiveRundown = 1,
	DuringHold = 2,
	NoCurrentPart = 3,
	NoCurrentOrNextPart = 4,
	AdlibCurrentPart = 5,
	AdlibNotFound = 6,
	AdlibUnplayable = 7,
	PieceAsAdlibNotFound = 8,
	PieceAsAdlibNotDirectPlayable = 9,
	PieceAsAdlibCurrentlyLive = 10,
	SourceLayerNotSticky = 11,
	SourceLayerStickyNothingFound = 12,
	BucketAdlibIncompatible = 13,
	TakeDuringTransition = 14,
	TakeCloseToAutonext = 15,
	HoldNotCancelable = 16,
	HoldNeedsNextPart = 17,
	HoldAlreadyActive = 18,
	HoldIncompatibleParts = 19,
	HoldAfterAdlib = 20,
	RundownAlreadyActive = 21,
	RundownAlreadyActiveNames = 22,
	RundownResetWhileActive = 23,
	RundownRegenerateWhileActive = 24,
	PartNotFound = 25,
	PartNotPlayable = 26,
	ActionsNotSupported = 27,
	TakeNoNextPart = 28,
	TakeRateLimit = 29,
	DisableNoPieceFound = 30,
	TakeBlockedDuration = 31,
	TakeFromIncorrectPart = 32,
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
	[UserErrorMessage.PieceAsAdlibNotDirectPlayable]: t(`Piece to take is not directly playable!`),
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
	[UserErrorMessage.RundownRegenerateWhileActive]: t(
		`Rundown Playlist is active, please deactivate it before regenerating it.`
	),
	[UserErrorMessage.PartNotFound]: t(`The selected part does not exist`),
	[UserErrorMessage.PartNotPlayable]: t(`The selected part cannot be played`),
	[UserErrorMessage.ActionsNotSupported]: t(`AdLib Actions are not supported in the current Rundown`),
	[UserErrorMessage.TakeNoNextPart]: t(`No Next point found, please set a part as Next before doing a TAKE.`),
	[UserErrorMessage.TakeRateLimit]: t(`Ignoring TAKES that are too quick after eachother ({{duration}} ms)`),
	[UserErrorMessage.DisableNoPieceFound]: t(`Found no future pieces`),
	[UserErrorMessage.TakeBlockedDuration]: t(`Cannot perform take for {{duration}}ms`),
	[UserErrorMessage.TakeFromIncorrectPart]: t(`Ignoring take as playing part has changed since TAKE was requested.`),
}

export class UserError {
	private constructor(
		/** The raw Error that was thrown */
		public readonly rawError: Error,
		/** The UserErrorMessage key (for matching certain error) */
		public readonly key: UserErrorMessage,
		/** The translatable string for the key */
		public readonly message: ITranslatableMessage
	) {}

	public toString(): string {
		return UserError.toJSON(this)
	}

	/** Create a UserError with a custom error for the log */
	static from(err: Error, key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		return new UserError(err, key, { key: UserErrorMessagesTranslations[key], args })
	}
	/** Create a UserError with a custom error for the log */
	static fromUnknown(err: unknown, key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		const err2 = err instanceof Error ? err : new Error(stringifyError(err))
		return new UserError(err2, key, { key: UserErrorMessagesTranslations[key], args })
	}

	/** Create a UserError duplicating the same error for the log */
	static create(key: UserErrorMessage, args?: { [k: string]: any }): UserError {
		return UserError.from(new Error(UserErrorMessagesTranslations[key]), key, args)
	}

	static tryFromJSON(str: string): UserError | undefined {
		try {
			const p = JSON.parse(str)
			if (UserError.isUserError(p)) {
				return new UserError(new Error(p.rawError.toString()), p.key, p.message)
			} else {
				return undefined
			}
		} catch (e: any) {
			return undefined
		}
	}

	static toJSON(e: UserError): string {
		return JSON.stringify({
			rawError: stringifyError(e.rawError),
			message: e.message,
			key: e.key,
		})
	}

	static isUserError(e: unknown): e is UserError {
		return !(e instanceof Error) && !!e && typeof e === 'object' && 'rawError' in e && 'message' in e && 'key' in e
	}
}
