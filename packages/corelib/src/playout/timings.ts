import { IBlueprintPartInTransition, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../dataModel/PartInstance'
import { DBPart } from '../dataModel/Part'
import { PieceInstance, PieceInstancePiece } from '../dataModel/PieceInstance'
import { Piece } from '../dataModel/Piece'
import { RundownHoldState } from '../dataModel/RundownPlaylist'

/**
 * Calculate the total pre-roll duration of a PartInstance
 * Note: once the part has been taken this should not be recalculated. Doing so may result in the timings shifting
 */
function calculatePartPreroll(pieces: CalculateTimingsPiece[]): number {
	const candidates: number[] = []
	for (const piece of pieces) {
		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// Ignore preroll for transition pieces
			continue
		}

		if (piece.enable.start === 'now') {
			// A piece starting at now was adlibbed, so does not affect the starting preroll
		} else if (piece.prerollDuration) {
			// How far before the part does the piece protrude
			candidates.push(Math.max(0, piece.prerollDuration - piece.enable.start))
		}
	}

	return Math.max(0, ...candidates)
}
/**
 * Calculate the total post-roll duration of a PartInstance
 */
function calculatePartPostroll(pieces: CalculateTimingsPiece[]): number {
	const candidates: number[] = []
	for (const piece of pieces) {
		if (!piece.postrollDuration) {
			continue
		}
		if (piece.enable.duration) {
			// presume it ends before we do a take
			continue
		}

		candidates.push(piece.postrollDuration)
	}

	return Math.max(0, ...candidates)
}

/**
 * Numbers are relative to the start of toPartGroup. Nothing should ever be negative, the pieces of toPartGroup will be delayed to allow for other things to complete.
 * Note: once the part has been taken this should not be recalculated. Doing so may result in the timings shifting if the preroll required for the part is found to have changed
 */
export interface PartCalculatedTimings {
	inTransitionStart: number | null // The start time within the toPartGroup of the inTransition
	toPartDelay: number // How long after the start of toPartGroup should piece time 0 be
	toPartPostroll: number
	fromPartRemaining: number // How long after the start of toPartGroup should fromPartGroup continue?
	fromPartPostroll: number
}

export type CalculateTimingsPiece = Pick<Piece, 'enable' | 'prerollDuration' | 'postrollDuration' | 'pieceType'>
export type CalculateTimingsFromPart = Pick<
	DBPart,
	'autoNext' | 'autoNextOverlap' | 'disableNextInTransition' | 'outTransition'
>

export type CalculateTimingsToPart = Pick<DBPart, 'inTransition'>

/**
 * Calculate the timings of the period where the parts can overlap.
 */
export function calculatePartTimings(
	holdState: RundownHoldState | undefined,
	fromPart: CalculateTimingsFromPart | undefined,
	fromPieces: CalculateTimingsPiece[] | undefined,
	toPart: CalculateTimingsToPart,
	toPieces: CalculateTimingsPiece[]
	// toPartPreroll: number
): PartCalculatedTimings {
	// If in a hold, we cant do the transition
	const isInHold =
		holdState !== RundownHoldState.NONE && holdState !== RundownHoldState.COMPLETE && holdState !== undefined

	const toPartPreroll = calculatePartPreroll(toPieces)
	const fromPartPostroll = fromPart && fromPieces ? calculatePartPostroll(fromPieces) : 0
	const toPartPostroll = calculatePartPostroll(toPieces)

	let inTransition: Omit<IBlueprintPartInTransition, 'blockTakeDuration'> | undefined
	let allowTransitionPiece: boolean | undefined
	if (fromPart && !isInHold) {
		if (fromPart.autoNext && fromPart.autoNextOverlap) {
			// An auto-next with overlap is essentially a simple transition, so we treat it as one
			allowTransitionPiece = false
			inTransition = {
				// blockTakeDuration: fromPartInstance.part.autoNextOverlap,
				partContentDelayDuration: 0,
				previousPartKeepaliveDuration: fromPart.autoNextOverlap,
			}
		} else if (!fromPart.disableNextInTransition) {
			allowTransitionPiece = true
			inTransition = toPart.inTransition
		}
	}

	// Try and convert the transition
	if (!inTransition || !fromPart) {
		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, fromPart?.outTransition?.duration ?? 0, toPartPreroll)

		return {
			inTransitionStart: null, // No transition to use
			// delay the new part for a bit
			toPartDelay: takeOffset,
			toPartPostroll,
			// The old part needs to continue for a while
			fromPartRemaining: takeOffset + fromPartPostroll,
			fromPartPostroll: fromPartPostroll,
		}
	} else {
		// The amount of time needed to complete the outTransition before the 'take' point
		const outTransitionTime = fromPart.outTransition
			? fromPart.outTransition.duration - inTransition.previousPartKeepaliveDuration
			: 0

		// The amount of time needed to preroll Part B before the 'take' point
		const prerollTime = toPartPreroll - inTransition.partContentDelayDuration

		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, outTransitionTime, prerollTime)

		return {
			inTransitionStart: allowTransitionPiece ? takeOffset : null,
			toPartDelay: takeOffset + inTransition.partContentDelayDuration,
			toPartPostroll: toPartPostroll,
			fromPartRemaining: takeOffset + inTransition.previousPartKeepaliveDuration + fromPartPostroll,
			fromPartPostroll: fromPartPostroll,
		}
	}
}

export function getPartTimingsOrDefaults(
	partInstance: DBPartInstance,
	pieceInstances: PieceInstance[]
): PartCalculatedTimings {
	if (partInstance.partPlayoutTimings) {
		return partInstance.partPlayoutTimings
	} else {
		return calculatePartTimings(
			RundownHoldState.NONE,
			undefined,
			undefined,
			partInstance.part,
			pieceInstances.map((p) => p.piece)
		)
	}
}

function calculatePartExpectedDurationWithPrerollInner(rawDuration: number, timings: PartCalculatedTimings): number {
	return Math.max(0, rawDuration + timings.toPartDelay - timings.fromPartRemaining)
}

export function calculatePartExpectedDurationWithPreroll(
	part: DBPart,
	pieces: PieceInstancePiece[]
): number | undefined {
	if (part.expectedDuration === undefined) return undefined

	const timings = calculatePartTimings(undefined, {}, [], part, pieces)

	return calculatePartExpectedDurationWithPrerollInner(part.expectedDuration, timings)
}

export function calculatePartInstanceExpectedDurationWithPreroll(
	partInstance: Pick<DBPartInstance, 'part' | 'partPlayoutTimings'>
): number | undefined {
	if (partInstance.part.expectedDuration === undefined) return undefined

	if (partInstance.partPlayoutTimings) {
		return calculatePartExpectedDurationWithPrerollInner(
			partInstance.part.expectedDuration,
			partInstance.partPlayoutTimings
		)
	} else {
		return partInstance.part.expectedDurationWithPreroll ?? partInstance.part.expectedDuration
	}
}
