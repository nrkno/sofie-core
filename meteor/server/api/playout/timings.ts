import { IBlueprintPartInTransition } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { RundownHoldState } from '../../../lib/collections/Rundowns'

/**
 * Calculate the total pre-roll duration of a PartInstance
 * Note: once the part has been taken this should not be recalculated. Doing so may result in the timings shifting
 */
function calculatePartPreroll(pieces: PieceInstance[]): number {
	const candidates: number[] = []
	for (const piece of pieces) {
		if (piece.piece.isTransition) {
			// Ignore preroll for transition pieces
			continue
		}

		if (piece.piece.enable.start === 'now') {
			// A piece starting at now was adlibbed, so does not affect the starting preroll
		} else if (piece.piece.prerollDuration) {
			// How far before the part does the piece protrude
			candidates.push(Math.max(0, piece.piece.prerollDuration - piece.piece.enable.start))
		}
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
	fromPartRemaining: number // How long after the start of toPartGroup should fromPartGroup continue?
}

/**
 * Calculate the timings of the period where the parts can overlap.
 */
export function calculatePartTimings(
	holdState: RundownHoldState | undefined,
	fromPartInstance: DBPartInstance | undefined,
	toPartInstance: DBPartInstance,
	toPieceInstances: PieceInstance[]
	// toPartPreroll: number
): PartCalculatedTimings {
	// If in a hold, we cant do the transition
	const isInHold = holdState !== RundownHoldState.NONE && holdState !== undefined

	const toPartPreroll = calculatePartPreroll(toPieceInstances)

	let inTransition: IBlueprintPartInTransition | undefined
	let allowTransitionPiece: boolean | undefined
	if (fromPartInstance && !isInHold) {
		if (fromPartInstance.part.autoNext && fromPartInstance.part.autoNextOverlap) {
			// An auto-next with overlap is essentially a simple transition, so we treat it as one
			allowTransitionPiece = false
			inTransition = {
				blockTakeDuration: fromPartInstance.part.autoNextOverlap,
				partContentDelayDuration: 0,
				previousPartKeepaliveDuration: fromPartInstance.part.autoNextOverlap,
			}
		} else if (!fromPartInstance.part.disableNextPartInTransition) {
			allowTransitionPiece = true
			inTransition = toPartInstance.part.inTransition
		}
	}

	// Try and convert the transition
	if (!inTransition || !fromPartInstance) {
		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, fromPartInstance?.part?.outTransitionDuration ?? 0, toPartPreroll)

		return {
			inTransitionStart: null, // No transition to use
			// delay the new part for a bit
			toPartDelay: takeOffset,
			// The old part needs to continue for a while
			fromPartRemaining: takeOffset,
		}
	} else {
		// The amount of time needed to complete the outTransition before the 'take' point
		const outTransitionTime = fromPartInstance.part.outTransitionDuration
			? fromPartInstance.part.outTransitionDuration - inTransition.previousPartKeepaliveDuration
			: 0

		// The amount of time needed to preroll Part B before the 'take' point
		const prerollTime = toPartPreroll - inTransition.partContentDelayDuration

		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, outTransitionTime, prerollTime)

		return {
			inTransitionStart: allowTransitionPiece ? takeOffset : null,
			toPartDelay: takeOffset + inTransition.partContentDelayDuration,
			fromPartRemaining: takeOffset + inTransition.previousPartKeepaliveDuration,
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
		return calculatePartTimings(RundownHoldState.NONE, undefined, partInstance, pieceInstances)
	}
}
