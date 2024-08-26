import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { PieceInstance } from '../dataModel/PieceInstance'
import { SourceLayers } from '../dataModel/ShowStyleBase'
import { assertNever, groupByToMapFunc } from '../lib'
import _ = require('underscore')
import { isCandidateBetterToBeContinued, isCandidateMoreImportant } from './infinites'
import { getPieceControlObjectId } from './ids'

/**
 * Get the `enable: { start: ?? }` for the new piece in terms that can be used as an `end` for another object
 */
function getPieceStartTimeAsReference(newPieceStart: number | 'now', newPiece: PieceInstance): number | string {
	return typeof newPieceStart === 'number' ? newPieceStart : `#${getPieceControlObjectId(newPiece)}.start`
}

function getPieceStartTimeWithinPart(p: PieceInstance): 'now' | number {
	// If the piece is dynamically inserted, then its preroll should be factored into its start time, but not for any infinite continuations
	const isStartOfAdlib =
		!!p.dynamicallyInserted && !(p.infinite?.fromPreviousPart || p.infinite?.fromPreviousPlayhead)

	if (isStartOfAdlib && p.piece.enable.start !== 'now') {
		return p.piece.enable.start + (p.piece.prerollDuration ?? 0)
	} else {
		return p.piece.enable.start
	}
}

function isClear(piece?: PieceInstance): boolean {
	return !!piece?.piece.virtual
}

function isCappedByAVirtual(
	activePieces: PieceInstanceOnInfiniteLayers,
	key: keyof PieceInstanceOnInfiniteLayers,
	newPiece: PieceInstance
): boolean {
	if (
		(key === 'onRundownEnd' || key === 'onShowStyleEnd') &&
		activePieces.onSegmentEnd &&
		isCandidateMoreImportant(newPiece, activePieces.onSegmentEnd)
	)
		return true
	if (
		key === 'onShowStyleEnd' &&
		activePieces.onRundownEnd &&
		isCandidateMoreImportant(newPiece, activePieces.onRundownEnd)
	)
		return true
	return false
}

export interface PieceInstanceWithTimings extends PieceInstance {
	/**
	 * This is a maximum end point of the pieceInstance.
	 * If the pieceInstance also has a enable.duration or userDuration set then the shortest one will need to be used
	 * This can be:
	 *  - 'now', if it was stopped by something that does not need a preroll (or is virtual)
	 *  - '#something.start + 100', if it was stopped by something that needs a preroll
	 *  - '100', if not relative to now at all
	 */
	resolvedEndCap?: number | string
	priority: number
}

/**
 * Process the infinite pieces to determine the start time and a maximum end time for each.
 * Any pieces which have no chance of being shown (duplicate start times) are pruned
 * The stacking order of infinites is considered, to define the stop times
 */
export function processAndPrunePieceInstanceTimings(
	sourceLayers: SourceLayers,
	pieces: PieceInstance[],
	nowInPart: number,
	keepDisabledPieces?: boolean,
	includeVirtual?: boolean
): PieceInstanceWithTimings[] {
	const results: PieceInstanceWithTimings[] = []

	// We want to group by exclusive groups, to let them be resolved
	const exclusiveGroupMap = new Map<string, string>()
	for (const layer of Object.values<ISourceLayer | undefined>(sourceLayers)) {
		if (layer?.exclusiveGroup) {
			exclusiveGroupMap.set(layer._id, layer.exclusiveGroup)
		}
	}

	const groupedPieces = groupByToMapFunc(
		keepDisabledPieces ? pieces : pieces.filter((p) => !p.disabled),
		// At this stage, if a Piece is disabled, the `keepDisabledPieces` must be turned on. If that's the case
		// we split out the disabled Pieces onto the sourceLayerId they actually exist on, instead of putting them
		// onto the shared "exclusivityGroup" layer. This may cause it to not display "exactly" accurately
		// while in the disabled state, but it should keep it from affecting any not-disabled Pieces.
		(p) =>
			p.disabled ? p.piece.sourceLayerId : exclusiveGroupMap.get(p.piece.sourceLayerId) || p.piece.sourceLayerId
	)
	for (const pieces of groupedPieces.values()) {
		// Group and sort the pieces so that we can step through each point in time
		const piecesByStart: Array<[number | 'now', PieceInstance[]]> = _.sortBy(
			Array.from(groupByToMapFunc(pieces, (p) => getPieceStartTimeWithinPart(p)).entries()).map(([k, v]) =>
				literal<[number | 'now', PieceInstance[]]>([k === 'now' ? 'now' : Number(k), v])
			),
			([k]) => (k === 'now' ? nowInPart : k)
		)

		// Step through time
		const activePieces: PieceInstanceOnInfiniteLayers = {}
		for (const [newPiecesStart, pieces] of piecesByStart) {
			const newPieces = findPieceInstancesOnInfiniteLayers(pieces)

			// Apply the updates
			// Note: order is important, the higher layers must be done first
			updateWithNewPieces(results, activePieces, newPieces, newPiecesStart, includeVirtual, 'other')
			updateWithNewPieces(results, activePieces, newPieces, newPiecesStart, includeVirtual, 'onSegmentEnd')
			updateWithNewPieces(results, activePieces, newPieces, newPiecesStart, includeVirtual, 'onRundownEnd')
			updateWithNewPieces(results, activePieces, newPieces, newPiecesStart, includeVirtual, 'onShowStyleEnd')
		}
	}

	// Strip out any pieces that start and end at the same point
	return results.filter((p) => p.resolvedEndCap === undefined || p.resolvedEndCap !== p.piece.enable.start)
}
function updateWithNewPieces(
	results: PieceInstanceWithTimings[],
	activePieces: PieceInstanceOnInfiniteLayers,
	newPieces: PieceInstanceOnInfiniteLayers,
	newPiecesStart: number | 'now',
	includeVirtual: boolean | undefined,
	key: keyof PieceInstanceOnInfiniteLayers
): void {
	const newPiece = newPieces[key]
	if (newPiece) {
		const activePiece = activePieces[key]
		if (activePiece) {
			activePiece.resolvedEndCap = getPieceStartTimeAsReference(newPiecesStart, newPiece)
		}
		// track the new piece
		activePieces[key] = newPiece

		// We don't want to include virtual pieces in the output (most of the time)
		// TODO - do we want to always output virtual pieces from the 'other' group?
		if (
			includeVirtual ||
			((!isClear(newPiece) || key === 'other') && !isCappedByAVirtual(activePieces, key, newPiece))
		) {
			// add the piece to results
			results.push(newPiece)

			if (
				key === 'onSegmentEnd' ||
				(key === 'onRundownEnd' && !activePieces.onSegmentEnd) ||
				(key === 'onShowStyleEnd' && !activePieces.onSegmentEnd && !activePieces.onRundownEnd)
			) {
				// when start === 0, we are likely to have multiple infinite continuations. Only stop the 'other' if it should not be considered for being on air
				if (
					activePieces.other &&
					(newPiecesStart !== 0 || isCandidateBetterToBeContinued(activePieces.other, newPiece))
				) {
					// These modes should stop the 'other' when they start if not hidden behind a higher priority onEnd
					activePieces.other.resolvedEndCap = getPieceStartTimeAsReference(newPiecesStart, newPiece)
					activePieces.other = undefined
				}
			}
		}
	}
}

interface PieceInstanceOnInfiniteLayers {
	onShowStyleEnd?: PieceInstanceWithTimings
	onRundownEnd?: PieceInstanceWithTimings
	onSegmentEnd?: PieceInstanceWithTimings
	other?: PieceInstanceWithTimings
}
function findPieceInstancesOnInfiniteLayers(pieces: PieceInstance[]): PieceInstanceOnInfiniteLayers {
	if (pieces.length === 0) {
		return {}
	}

	const res: PieceInstanceOnInfiniteLayers = {}

	for (const piece of pieces) {
		switch (piece.piece.lifespan) {
			case PieceLifespan.OutOnShowStyleEnd:
				if (!res.onShowStyleEnd || isCandidateBetterToBeContinued(res.onShowStyleEnd, piece)) {
					res.onShowStyleEnd = {
						...piece,
						priority: 0,
					}
				}
				break
			case PieceLifespan.OutOnRundownEnd:
				if (!res.onRundownEnd || isCandidateBetterToBeContinued(res.onRundownEnd, piece)) {
					res.onRundownEnd = {
						...piece,
						priority: 1,
					}
				}
				break
			case PieceLifespan.OutOnSegmentEnd:
				if (!res.onSegmentEnd || isCandidateBetterToBeContinued(res.onSegmentEnd, piece)) {
					res.onSegmentEnd = {
						...piece,
						priority: 2,
					}
				}
				break
			case PieceLifespan.OutOnRundownChange:
			case PieceLifespan.OutOnSegmentChange:
			case PieceLifespan.WithinPart:
				if (!res.other || isCandidateBetterToBeContinued(res.other, piece)) {
					res.other = {
						...piece,
						priority: 5,
					}
				}
				break
			default:
				assertNever(piece.piece.lifespan)
		}
	}

	return res
}
