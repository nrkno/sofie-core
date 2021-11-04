import { IBlueprintPartInTransition } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { RundownHoldState } from '../../../lib/collections/Rundowns'

/** Calculate the total pre-roll duration of a PartInstance */
function calculatePartPreroll(pieces: PieceInstance[]): number {
	// TODO - in theory this could 'drift' once PartInstance.startedPlayback is defined if an adlib/action adds a piece with a really long preroll

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

/** Numbers are relative to a 'now' point, which gives enough time for things to happen. Values should never be negative, and one will always be 0 */
export interface PartCalculatedTimings {
	inTransitionStart: number | null // The start time within the toPartGroup of the inTransition
	outTransitionStart: number // How long after the start of toPartGroup, the fromPart outTransition should begin (is this useful?) TODO - won't this get stale if the part property gets changed on the fly?
	toPartDelay: number // How long after the start of toPartGroup should piece time 0 be
	fromPartRemaining: number // How long after the start of toPartGroup should fromPartGroup continue?
	contentPreroll: number // TODO - is this needed?
}

/**
 * Calculate the timings of the period where the parts can overlap
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
	if (fromPartInstance && !isInHold) {
		if (fromPartInstance.part.autoNext && fromPartInstance.part.autoNextOverlap) {
			inTransition = {
				blockTakeDuration: fromPartInstance.part.autoNextOverlap,
				partContentDelayDuration: 0,
				previousPartKeepaliveDuration: fromPartInstance.part.autoNextOverlap,
			}
		} else if (!fromPartInstance.part.disableNextPartInTransition) {
			inTransition = toPartInstance.part.inTransition
		}
	}

	// Try and convert the transition
	if (
		// (fromPartInstance.part.autoNext && fromPartInstance.part.autoNextOverlap) ||
		// fromPartInstance.part.disableNextPartInTransition ||
		!inTransition ||
		!fromPartInstance
	) {
		const outDuration = Math.max(0, fromPartInstance?.part?.outTransitionDuration ?? 0)
		// const autoNextOverlap = Math.max(0, fromPartInstance.part.autoNextOverlap ?? 0)

		// TODO - this should use toPartPreroll too?
		// TODO - is this correct for hold?

		return {
			inTransitionStart: null, // No transition to use
			outTransitionStart: 0,
			// delay the new part for a bit
			toPartDelay: Math.max(0, outDuration),
			// The old part needs to continue for a while
			fromPartRemaining: outDuration,
			contentPreroll: toPartPreroll,
		}

		// // An autoNextOverlap acts a little like an inTransition with just a preroll. We can do simpler maths here
		// // TODO - should it use the same maths?
		// const outDuration = Math.max(0, fromPartInstance.part.outTransitionDuration ?? 0)
		// const autoNextOverlap = Math.max(0, fromPartInstance.part.autoNextOverlap ?? 0)

		// return {
		// 	inTransitionStart: null, // No transition to use
		// 	// Either delay the next part, or the out transition
		// 	outTransitionStart: Math.max(0, autoNextOverlap - outDuration),
		// 	toPartDelay: Math.max(0, outDuration - autoNextOverlap),
		// 	// The old part may need to continue for a while
		// 	fromPartRemaining: outDuration + autoNextOverlap,
		// }
	} else {
		/** TODO - this is complex and confusing, and needs a better mapping to what the codepen tool is doing */

		// The amount of time needed to complete the outTransition before the 'take' point
		const outTransitionTime = fromPartInstance.part.outTransitionDuration
			? fromPartInstance.part.outTransitionDuration - inTransition.previousPartKeepaliveDuration
			: 0

		// The amount of time needed to preroll Part B before the 'take' point
		const prerollTime = toPartPreroll - inTransition.partContentDelayDuration

		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const inTransitionStart = Math.max(0, outTransitionTime, prerollTime)

		return {
			inTransitionStart,
			outTransitionStart: Math.max(0, inTransition.previousPartKeepaliveDuration - inTransitionStart),
			toPartDelay: inTransition.partContentDelayDuration - toPartPreroll,
			fromPartRemaining: 0, // TODO
			contentPreroll: toPartPreroll,
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
