import _ from 'underscore'
import { PartInstance, PartInstanceId } from '../collections/PartInstances'
import {
	PieceInstance,
	PieceInstancePiece,
	rewrapPieceToInstance,
	unprotectPieceInstance,
} from '../collections/PieceInstances'
import { DBPart, PartId } from '../collections/Parts'
import { Piece } from '../collections/Pieces'
import { SegmentId } from '../collections/Segments'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { assertNever, max, flatten, literal, protectString } from '../lib'
import { Mongo } from 'meteor/mongo'
import { ShowStyleBase } from '../collections/ShowStyleBases'

export function buildPiecesStartingInThisPartQuery(part: DBPart): Mongo.Query<Piece> {
	return { startPartId: part._id }
}

export function buildPastInfinitePiecesForThisPartQuery(
	part: DBPart,
	partsIdsBeforeThisInSegment: PartId[],
	segmentsIdsBeforeThisInRundown: SegmentId[]
): Mongo.Query<Piece> {
	return {
		invalid: { $ne: true },
		startPartId: { $ne: part._id },
		$or: [
			{
				// same segment, and previous part
				lifespan: {
					$in: [
						PieceLifespan.OutOnSegmentEnd,
						PieceLifespan.OutOnSegmentChange,
						PieceLifespan.OutOnRundownEnd,
						PieceLifespan.OutOnRundownChange,
					],
				},
				startRundownId: part.rundownId,
				startSegmentId: part.segmentId,
				startPartId: { $in: partsIdsBeforeThisInSegment },
			},
			{
				// same rundown, and previous segment
				lifespan: { $in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange] },
				startRundownId: part.rundownId,
				startSegmentId: { $in: segmentsIdsBeforeThisInRundown },
			},
			// {
			// 	// previous rundown
			//  // Potential future scope
			// }
		],
	}
}

export function getPlayheadTrackingInfinitesForPart(
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	currentPartInstance: PartInstance,
	currentPartPieceInstances: PieceInstance[],
	part: DBPart,
	newInstanceId: PartInstanceId,
	nextPartIsAfterCurrentPart: boolean,
	isTemporary: boolean
): PieceInstance[] {
	const canContinueAdlibOnEnds = nextPartIsAfterCurrentPart
	interface InfinitePieceSet {
		[PieceLifespan.OutOnRundownEnd]?: PieceInstance
		[PieceLifespan.OutOnSegmentEnd]?: PieceInstance
		onChange?: PieceInstance
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	const groupedPlayingPieceInstances = _.groupBy(currentPartPieceInstances, (p) => p.piece.sourceLayerId)
	for (const [sourceLayerId, pieceInstances] of Object.entries(groupedPlayingPieceInstances)) {
		// Find the one that starts last. Note: any piece will stop an onChange
		const lastPieceInstance =
			pieceInstances.find((p) => p.piece.enable.start === 'now') ??
			max(pieceInstances, (p) => p.piece.enable.start)
		if (lastPieceInstance) {
			// If it is an onChange, then it may want to continue
			let isUsed = false
			switch (lastPieceInstance.piece.lifespan) {
				case PieceLifespan.OutOnSegmentChange:
					if (currentPartInstance?.segmentId === part.segmentId) {
						// Still in the same segment
						isUsed = true
					}
					break
				case PieceLifespan.OutOnRundownChange:
					if (lastPieceInstance.rundownId === part.rundownId) {
						// Still in the same rundown
						isUsed = true
					}
					break
			}

			if (isUsed) {
				const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? {}
				pieceSet.onChange = lastPieceInstance
				piecesOnSourceLayers.set(sourceLayerId, pieceSet)
				// This may get pruned later, if somethng else has a start of 0
			}
		}

		// Check if we should persist any adlib onEnd infinites
		if (canContinueAdlibOnEnds) {
			const piecesByInfiniteMode = _.groupBy(pieceInstances, (p) => p.piece.lifespan)
			for (const mode0 of [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnSegmentEnd]) {
				const mode = mode0 as PieceLifespan.OutOnRundownEnd | PieceLifespan.OutOnSegmentEnd
				const pieces = (piecesByInfiniteMode[mode] || []).filter(
					(p) => p.infinite?.fromPreviousPlayhead || p.dynamicallyInserted
				)
				// This is the piece we may copy across
				const candidatePiece =
					pieces.find((p) => p.piece.enable.start === 'now') ?? max(pieces, (p) => p.piece.enable.start)
				if (candidatePiece) {
					// Check this infinite is allowed to continue to this part
					let isValid = false
					switch (mode) {
						case PieceLifespan.OutOnSegmentEnd:
							isValid =
								currentPartInstance.segmentId === part.segmentId &&
								partsBeforeThisInSegmentSet.has(candidatePiece.piece.startPartId)
							break
						case PieceLifespan.OutOnRundownEnd:
							isValid =
								candidatePiece.rundownId === part.rundownId &&
								(segmentsBeforeThisInRundownSet.has(currentPartInstance.segmentId) ||
									currentPartInstance.segmentId === part.segmentId)
							break
					}

					if (isValid) {
						const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? {}
						pieceSet[mode] = candidatePiece
						piecesOnSourceLayers.set(sourceLayerId, pieceSet)
					}
				}
			}
		}
	}

	const rewrapInstance = (p: PieceInstance) => {
		const instance = rewrapPieceToInstance(p.piece, part.rundownId, newInstanceId, isTemporary)
		instance._id = protectString(`${instance._id}_continue`)

		// instance.infinite = p.infinite
		if (p.infinite) {
			// This was copied from before, so we know we can force the time to 0
			instance.piece = {
				...instance.piece,
				enable: {
					start: 0,
				},
			}
			instance.infinite = {
				...p.infinite,
				fromPreviousPart: true,
				fromPreviousPlayhead: true,
			}
			instance.adLibSourceId = p.adLibSourceId
		}

		return instance
	}

	return flatten(
		Array.from(piecesOnSourceLayers.values()).map((ps) => {
			return _.compact(Object.values(ps)).map(rewrapInstance)
		})
	)
}

export function isPiecePotentiallyActiveInPart(
	previousPartInstance: PartInstance | undefined,
	partsBeforeThisInSegment: Set<PartId>,
	segmentsBeforeThisInRundown: Set<SegmentId>,
	part: DBPart,
	pieceToCheck: Piece
): boolean {
	// If its from the current part
	if (pieceToCheck.startPartId === part._id) {
		return true
	}

	switch (pieceToCheck.lifespan) {
		case PieceLifespan.WithinPart:
			// This must be from another part
			return false
		case PieceLifespan.OutOnSegmentEnd:
			return (
				pieceToCheck.startSegmentId === part.segmentId && partsBeforeThisInSegment.has(pieceToCheck.startPartId)
			)
		case PieceLifespan.OutOnRundownEnd:
			if (pieceToCheck.startRundownId === part.rundownId) {
				if (pieceToCheck.startSegmentId === part.segmentId) {
					return partsBeforeThisInSegment.has(pieceToCheck.startPartId)
				} else {
					return segmentsBeforeThisInRundown.has(pieceToCheck.startSegmentId)
				}
			} else {
				return false
			}
		case PieceLifespan.OutOnSegmentChange:
			if (previousPartInstance !== undefined) {
				// This gets handled by getPlayheadTrackingInfinitesForPart
				// We will only copy the pieceInstance from the previous, never using the original piece
				return false
			} else {
				// Predicting what will happen at arbitrary point in the future
				return (
					pieceToCheck.startSegmentId === part.segmentId &&
					partsBeforeThisInSegment.has(pieceToCheck.startPartId)
				)
			}
		case PieceLifespan.OutOnRundownChange:
			if (previousPartInstance !== undefined) {
				// This gets handled by getPlayheadTrackingInfinitesForPart
				// We will only copy the pieceInstance from the previous, never using the original piece
				return false
			} else {
				// Predicting what will happen at arbitrary point in the future
				return (
					pieceToCheck.startRundownId === part.rundownId &&
					segmentsBeforeThisInRundown.has(pieceToCheck.startSegmentId)
				)
			}
		default:
			assertNever(pieceToCheck.lifespan)
			return false
	}
}

export function getPieceInstancesForPart(
	playingPartInstance: PartInstance | undefined,
	playingPieceInstances: PieceInstance[] | undefined,
	part: DBPart,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	possiblePieces: Piece[],
	orderedPartIds: PartId[],
	newInstanceId: PartInstanceId,
	nextPartIsAfterCurrentPart: boolean,
	isTemporary: boolean
): PieceInstance[] {
	const doesPieceAStartBeforePieceB = (pieceA: PieceInstancePiece, pieceB: PieceInstancePiece): boolean => {
		if (pieceA.startPartId === pieceB.startPartId) {
			return pieceA.enable.start < pieceB.enable.start
		}
		const pieceAIndex = orderedPartIds.indexOf(pieceA.startPartId)
		const pieceBIndex = orderedPartIds.indexOf(pieceB.startPartId)

		if (pieceAIndex === -1) {
			return false
		} else if (pieceBIndex === -1) {
			return true
		} else if (pieceAIndex < pieceBIndex) {
			return true
		} else {
			return false
		}
	}

	interface InfinitePieceSet {
		[PieceLifespan.OutOnRundownEnd]?: Piece
		[PieceLifespan.OutOnSegmentEnd]?: Piece
		// onChange?: PieceInstance
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	// Filter down to the last starting onEnd infinite per layer
	for (const candidatePiece of possiblePieces) {
		if (
			candidatePiece.startPartId !== part._id &&
			(candidatePiece.lifespan === PieceLifespan.OutOnRundownEnd ||
				candidatePiece.lifespan === PieceLifespan.OutOnSegmentEnd)
		) {
			const useIt = isPiecePotentiallyActiveInPart(
				playingPartInstance,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				part,
				candidatePiece
			)

			if (useIt) {
				const pieceSet = piecesOnSourceLayers.get(candidatePiece.sourceLayerId) ?? {}
				const existingPiece = pieceSet[candidatePiece.lifespan]
				if (!existingPiece || doesPieceAStartBeforePieceB(existingPiece, candidatePiece)) {
					pieceSet[candidatePiece.lifespan] = candidatePiece
					piecesOnSourceLayers.set(candidatePiece.sourceLayerId, pieceSet)
				}
			}
		}
	}

	// OnChange infinites take priority over onEnd, as they travel with the playhead
	const infinitesFromPrevious = playingPartInstance
		? getPlayheadTrackingInfinitesForPart(
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				playingPartInstance,
				playingPieceInstances || [],
				part,
				newInstanceId,
				nextPartIsAfterCurrentPart,
				isTemporary
		  )
		: []

	// Compile the resulting list

	const wrapPiece = (p: PieceInstancePiece) => {
		const instance = rewrapPieceToInstance(p, part.rundownId, newInstanceId, isTemporary)

		if (!instance.infinite && instance.piece.lifespan !== PieceLifespan.WithinPart) {
			instance.infinite = {
				infinitePieceId: instance.piece._id,
				fromPreviousPart: instance.piece.startPartId !== part._id,
			}
		}
		if (instance.infinite?.fromPreviousPart) {
			// If this is not the start point, it should start at 0
			// Note: this should not be setitng fromPreviousPlayhead, as it is not from the playhead
			instance.piece = {
				...instance.piece,
				enable: {
					start: 0,
				},
			}
		}

		return instance
	}

	const normalPieces = possiblePieces.filter((p) => p.startPartId === part._id)
	const result = normalPieces.map(wrapPiece).concat(infinitesFromPrevious)
	for (const pieceSet of Array.from(piecesOnSourceLayers.values())) {
		const basicPieces = _.compact([
			pieceSet[PieceLifespan.OutOnRundownEnd],
			pieceSet[PieceLifespan.OutOnSegmentEnd],
		])
		result.push(...basicPieces.map(wrapPiece))

		// if (pieceSet.onChange) {
		// 	result.push(rewrapInstance(pieceSet.onChange))
		// }
	}

	return result
}

export interface PieceInstanceWithTimings extends PieceInstance {
	/**
	 * This is a maximum end point of the pieceInstance.
	 * If the pieceInstance also has a enable.duration of userDuration set then the shortest one will need to be used
	 * This can be:
	 *  - 'now', if it was stopped by something that does not need a preroll (or is virtual)
	 *  - '#something.start + 100', if it was stopped by something that needs a preroll
	 *  - '100', if not relative to now at all
	 */
	resolvedEndCap?: number | string
	priority: number
}

function offsetFromStart(start: number | 'now', newPiece: PieceInstance): number | string {
	const offset = newPiece.piece.adlibPreroll
	if (!offset) return start

	return typeof start === 'number'
		? start + offset
		: `#${getPieceGroupId(unprotectPieceInstance(newPiece))}.start + ${offset}`
}

/**
 * Process the infinite pieces to determine the start time and a maximum end time for each.
 * Any pieces which have no chance of being shown (duplicate start times) are pruned
 * The stacking order of infinites is considered, to define the stop times
 */
export function processAndPrunePieceInstanceTimings(
	showStyle: ShowStyleBase,
	pieces: PieceInstance[],
	nowInPart: number
): PieceInstanceWithTimings[] {
	const result: PieceInstanceWithTimings[] = []

	let activePieces: PieceInstanceOnInfiniteLayers = {}
	const updateWithNewPieces = (
		newPieces: PieceInstanceOnInfiniteLayers,
		key: keyof PieceInstanceOnInfiniteLayers,
		start: number | 'now'
	): void => {
		const newPiece = newPieces[key]
		if (newPiece) {
			const activePiece = activePieces[key]
			if (activePiece) {
				activePiece.resolvedEndCap = offsetFromStart(start, newPiece)
			}
			activePieces[key] = newPiece
			result.push(newPiece)

			if (activePieces.other) {
				if (key === 'onSegmentEnd' || (key === 'onRundownEnd' && !activePieces.onSegmentEnd)) {
					// These modes should stop the 'other' when they start if not hidden behind a high priority onEnd
					activePieces.other.resolvedEndCap = offsetFromStart(start, newPiece)
					activePieces.other = undefined
				}
			}
		}
	}

	// We want to group by exclusive groups, to let them be resolved
	const exclusiveGroupMap = new Map<string, string>()
	for (const layer of showStyle.sourceLayers) {
		if (layer.exclusiveGroup) {
			exclusiveGroupMap.set(layer._id, layer.exclusiveGroup)
		}
	}

	const groupedPieces = _.groupBy(
		pieces.filter((p) => !p.disabled),
		(p) => exclusiveGroupMap.get(p.piece.sourceLayerId) || p.piece.sourceLayerId
	)
	for (const pieces of Object.values(groupedPieces)) {
		// Group and sort the pieces so that we can step through each point in time
		const piecesByStart: Array<[number | 'now', PieceInstance[]]> = _.sortBy(
			Object.entries(_.groupBy(pieces, (p) => p.piece.enable.start)).map(([k, v]) =>
				literal<[number | 'now', PieceInstance[]]>([k === 'now' ? 'now' : Number(k), v])
			),
			([k]) => (k === 'now' ? nowInPart : k)
		)

		const isClear = (piece?: PieceInstance): boolean => !!piece?.piece.virtual

		// Step through time
		activePieces = {}
		for (const [start, pieces] of piecesByStart) {
			const newPieces = findPieceInstancesOnInfiniteLayers(pieces)

			// Handle any clears
			if (isClear(newPieces.onSegmentEnd)) {
				if (activePieces.onSegmentEnd) {
					activePieces.onSegmentEnd.resolvedEndCap = start
					activePieces.onSegmentEnd = undefined
				}
				newPieces.onSegmentEnd = undefined
			}
			if (isClear(newPieces.onRundownEnd)) {
				if (activePieces.onRundownEnd) {
					activePieces.onRundownEnd.resolvedEndCap = start
					activePieces.onRundownEnd = undefined
				}
				newPieces.onRundownEnd = undefined
			}

			// Apply the updates
			// Note: order is important, the higher layers must be done first
			updateWithNewPieces(newPieces, 'other', start)
			updateWithNewPieces(newPieces, 'onSegmentEnd', start)
			updateWithNewPieces(newPieces, 'onRundownEnd', start)
		}
	}

	return result
}

interface PieceInstanceOnInfiniteLayers {
	onRundownEnd?: PieceInstanceWithTimings
	onSegmentEnd?: PieceInstanceWithTimings
	other?: PieceInstanceWithTimings
}
function findPieceInstancesOnInfiniteLayers(pieces: PieceInstance[]): PieceInstanceOnInfiniteLayers {
	if (pieces.length === 0) {
		return {}
	}

	const res: PieceInstanceOnInfiniteLayers = {}

	const isCandidateBetter = (best: PieceInstance, candidate: PieceInstance): boolean => {
		// Prioritise the one from this part over previous part
		if (best.infinite?.fromPreviousPart && !candidate.infinite?.fromPreviousPart) {
			// Prefer the candidate as it is not from previous
			return true
		}
		if (!best.infinite?.fromPreviousPart && candidate.infinite?.fromPreviousPart) {
			// Prefer the best as it is not from previous
			return false
		}

		// If we have adlibs, prefer the newest
		if (best.piece.enable.start === 'now') {
			// If we are working for the 'now' time, then we are looking at adlibs
			// All adlib pieces will have a take time, so prefer the later one
			const take0 = best.dynamicallyInserted
			const take1 = candidate.dynamicallyInserted
			if (take0 !== undefined && take1 !== undefined) {
				return take1 > take0
			}
		}

		// If one is virtual, prefer that
		if (best.piece.virtual && !candidate.piece.virtual) {
			// Prefer the virtual best
			return false
		}
		if (!best.piece.virtual && candidate.piece.virtual) {
			// Prefer the virtual candidate
			return true
		}

		// Fallback to id, as we dont have any other criteria and this will be stable.
		// Note: we shouldnt even get here, as it shouldnt be possible for multiple to start at the same time, but it is possible
		return best.piece._id < candidate.piece._id
	}

	for (const piece of pieces) {
		switch (piece.piece.lifespan) {
			case PieceLifespan.OutOnRundownEnd:
				if (!res.onRundownEnd || isCandidateBetter(res.onRundownEnd, piece)) {
					res.onRundownEnd = {
						...piece,
						priority: 1,
					}
				}
				break
			case PieceLifespan.OutOnSegmentEnd:
				if (!res.onSegmentEnd || isCandidateBetter(res.onSegmentEnd, piece)) {
					res.onSegmentEnd = {
						...piece,
						priority: 2,
					}
				}
				break
			case PieceLifespan.OutOnRundownChange:
			case PieceLifespan.OutOnSegmentChange:
			case PieceLifespan.WithinPart:
				if (!res.other || isCandidateBetter(res.other, piece)) {
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
