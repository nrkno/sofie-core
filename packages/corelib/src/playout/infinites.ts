import { Piece } from '../dataModel/Piece'
import { DBPart } from '../dataModel/Part'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '../dataModel/Ids'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../dataModel/PieceInstance'
import { DBPartInstance } from '../dataModel/PartInstance'
import { DBRundown } from '../dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { assertNever, flatten, getRandomId, groupByToMapFunc, max, normalizeArrayToMapFunc } from '../lib'
import { protectString } from '../protectedString'
import _ = require('underscore')
import { MongoQuery } from '../mongo'

export function buildPiecesStartingInThisPartQuery(part: DBPart): MongoQuery<Piece> {
	return { startPartId: part._id }
}

export function buildPastInfinitePiecesForThisPartQuery(
	part: DBPart,
	partsIdsBeforeThisInSegment: PartId[],
	segmentsIdsBeforeThisInRundown: SegmentId[],
	rundownIdsBeforeThisInPlaylist: RundownId[]
): MongoQuery<Piece> | null {
	const fragments = _.compact([
		partsIdsBeforeThisInSegment.length > 0
			? {
					// same segment, and previous part
					lifespan: {
						$in: [
							PieceLifespan.OutOnSegmentEnd,
							PieceLifespan.OutOnSegmentChange,
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: partsIdsBeforeThisInSegment },
			  }
			: undefined,
		segmentsIdsBeforeThisInRundown.length > 0
			? {
					// same rundown, and previous segment
					lifespan: {
						$in: [
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
					startRundownId: part.rundownId,
					startSegmentId: { $in: segmentsIdsBeforeThisInRundown },
			  }
			: undefined,
		rundownIdsBeforeThisInPlaylist.length > 0
			? {
					// previous rundown
					lifespan: {
						$in: [PieceLifespan.OutOnShowStyleEnd],
					},
					startRundownId: { $in: rundownIdsBeforeThisInPlaylist },
			  }
			: undefined,
	])

	if (fragments.length === 0) {
		return null
	} else if (fragments.length === 1) {
		return {
			invalid: { $ne: true },
			startPartId: { $ne: part._id },
			...fragments[0],
		}
	} else {
		return {
			invalid: { $ne: true },
			startPartId: { $ne: part._id },
			$or: fragments,
		}
	}
}

export function getPlayheadTrackingInfinitesForPart(
	playlistActivationId: RundownPlaylistActivationId,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	rundownsBeforeThisInPlaylist: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	currentPartInstance: DBPartInstance,
	currentPartPieceInstances: PieceInstance[],
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
	part: DBPart,
	newInstanceId: PartInstanceId,
	nextPartIsAfterCurrentPart: boolean,
	isTemporary: boolean
): PieceInstance[] {
	const canContinueAdlibOnEnds = nextPartIsAfterCurrentPart
	interface InfinitePieceSet {
		[PieceLifespan.OutOnShowStyleEnd]?: PieceInstance
		[PieceLifespan.OutOnRundownEnd]?: PieceInstance
		[PieceLifespan.OutOnSegmentEnd]?: PieceInstance
		onChange?: PieceInstance
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	const canContinueShowStyleEndInfinites = continueShowStyleEndInfinites(
		rundownsBeforeThisInPlaylist,
		rundownsToShowstyles,
		currentPartInstance.rundownId,
		rundown
	)

	const groupedPlayingPieceInstances = groupByToMapFunc(currentPartPieceInstances, (p) => p.piece.sourceLayerId)
	for (const [sourceLayerId, pieceInstances] of groupedPlayingPieceInstances.entries()) {
		// Find the ones that starts last. Note: any piece will stop an onChange
		const lastPiecesByStart = groupByToMapFunc(pieceInstances, (p) => p.piece.enable.start)
		let lastPieceInstances = lastPiecesByStart.get('now') ?? []
		if (lastPieceInstances.length === 0) {
			const target = max(Array.from(lastPiecesByStart.keys()), (k) => Number(k))
			if (target !== undefined) {
				lastPieceInstances = lastPiecesByStart.get(target) ?? []
			}
		}

		// Some basic resolving, to figure out which is our candidate
		let lastPieceInstance: PieceInstance | undefined
		for (const candidate of lastPieceInstances) {
			if (lastPieceInstance === undefined || isCandidateBetterToBeContinued(lastPieceInstance, candidate)) {
				lastPieceInstance = candidate
			}
		}

		if (lastPieceInstance && !lastPieceInstance.plannedStoppedPlayback && !lastPieceInstance.userDuration) {
			// If it is an onChange, then it may want to continue
			let isUsed = false
			switch (lastPieceInstance.piece.lifespan) {
				case PieceLifespan.OutOnSegmentChange:
					if (currentPartInstance.segmentId === part.segmentId) {
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
			const piecesByInfiniteMode = groupByToMapFunc(
				pieceInstances.filter((p) => p.dynamicallyInserted),
				(p) => p.piece.lifespan
			)
			for (const mode0 of [
				PieceLifespan.OutOnRundownEnd,
				PieceLifespan.OutOnSegmentEnd,
				PieceLifespan.OutOnShowStyleEnd,
			]) {
				const mode = mode0 as
					| PieceLifespan.OutOnRundownEnd
					| PieceLifespan.OutOnSegmentEnd
					| PieceLifespan.OutOnShowStyleEnd
				const pieces = (piecesByInfiniteMode.get(mode) || []).filter(
					(p) => p.infinite && (p.infinite.fromPreviousPlayhead || p.dynamicallyInserted)
				)
				// This is the piece we may copy across
				const candidatePiece =
					pieces.find((p) => p.piece.enable.start === 'now') ?? max(pieces, (p) => p.piece.enable.start)
				if (candidatePiece && !candidatePiece.plannedStoppedPlayback && !candidatePiece.userDuration) {
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
						case PieceLifespan.OutOnShowStyleEnd:
							isValid = canContinueShowStyleEndInfinites
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

	const rewrapInstance = (p: PieceInstance | undefined): PieceInstance | undefined => {
		if (p) {
			const instance = rewrapPieceToInstance(
				p.piece,
				playlistActivationId,
				part.rundownId,
				newInstanceId,
				isTemporary
			)
			markPieceInstanceAsContinuation(p, instance)

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
					infiniteInstanceIndex: p.infinite.infiniteInstanceIndex + 1,
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
				}

				return instance
			}
		}
		return undefined
	}

	return flatten(
		Array.from(piecesOnSourceLayers.values()).map((ps) => {
			return _.compact(Object.values<PieceInstance | undefined>(ps as any).map(rewrapInstance))
		})
	)
}

function markPieceInstanceAsContinuation(previousInstance: PieceInstance, instance: PieceInstance) {
	instance._id = protectString(`${instance._id}_continue`)
	instance.dynamicallyInserted = previousInstance.dynamicallyInserted
	instance.adLibSourceId = previousInstance.adLibSourceId
	instance.reportedStartedPlayback = previousInstance.reportedStartedPlayback
	instance.plannedStartedPlayback = previousInstance.plannedStartedPlayback
}

export function isPiecePotentiallyActiveInPart(
	previousPartInstance: DBPartInstance | undefined,
	partsBeforeThisInSegment: Set<PartId>,
	segmentsBeforeThisInRundown: Set<SegmentId>,
	rundownsBeforeThisInPlaylist: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
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
		case PieceLifespan.OutOnShowStyleEnd:
			return previousPartInstance && pieceToCheck.lifespan === PieceLifespan.OutOnShowStyleEnd
				? continueShowStyleEndInfinites(
						rundownsBeforeThisInPlaylist,
						rundownsToShowstyles,
						previousPartInstance.rundownId,
						rundown
				  )
				: false
		default:
			assertNever(pieceToCheck.lifespan)
			return false
	}
}

/**
 * Calculate all of the onEnd PieceInstances for a PartInstance
 * @param playlistActivationId The current playlist ActivationId
 * @param playingPartInstance The current PartInstance, if there is one
 * @param playingPieceInstances The PieceInstances from the current PartInstance
 * @param rundown The Rundown the Part belongs to
 * @param part The Part the PartInstance is based on
 * @param partsBeforeThisInSegmentSet Set of PartIds that exist in the Segment before the part being processed
 * @param segmentsBeforeThisInRundownSet Set of SegmentIds that exist in the Rundown before the part being processed
 * @param rundownsBeforeThisInPlaylist Set of RundownIds that exist in the Playlist before the part being processed
 * @param rundownsToShowstyles Lookup of RundownIds in the Playlist, to their ShowStyleBase id
 * @param possiblePieces Array of Pieces that should be considered for being a PieceInstance in the new PartInstance
 * @param orderedPartIds Ordered array of all PartId in the Rundown
 * @param newInstanceId Id of the PartInstance
 * @param nextPartIsAfterCurrentPart Whether the new Part existing after the playlingPartInstane in the Rundown
 * @param isTemporary Whether to mark these PieceInstances as temporary
 * @returns Array of PieceInstances for the specified PartInstance
 */
export function getPieceInstancesForPart(
	playlistActivationId: RundownPlaylistActivationId,
	playingPartInstance: DBPartInstance | undefined,
	playingPieceInstances: PieceInstance[] | undefined,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
	part: DBPart,
	partsBeforeThisInSegmentSet: Set<PartId>,
	segmentsBeforeThisInRundownSet: Set<SegmentId>,
	rundownsBeforeThisInPlaylist: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
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
		[PieceLifespan.OutOnShowStyleEnd]?: Piece
		[PieceLifespan.OutOnRundownEnd]?: Piece
		[PieceLifespan.OutOnSegmentEnd]?: Piece
		// onChange?: PieceInstance
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	// Filter down to the last starting onEnd infinite per layer
	for (const candidatePiece of possiblePieces) {
		if (
			candidatePiece.startPartId !== part._id &&
			(candidatePiece.lifespan === PieceLifespan.OutOnShowStyleEnd ||
				candidatePiece.lifespan === PieceLifespan.OutOnRundownEnd ||
				candidatePiece.lifespan === PieceLifespan.OutOnSegmentEnd)
		) {
			const useIt = isPiecePotentiallyActiveInPart(
				playingPartInstance,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				rundownsBeforeThisInPlaylist,
				rundownsToShowstyles,
				rundown,
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
				playlistActivationId,
				partsBeforeThisInSegmentSet,
				segmentsBeforeThisInRundownSet,
				rundownsBeforeThisInPlaylist,
				rundownsToShowstyles,
				playingPartInstance,
				playingPieceInstances || [],
				rundown,
				part,
				newInstanceId,
				nextPartIsAfterCurrentPart,
				isTemporary
		  )
		: []

	// Compile the resulting list

	const playingPieceInstancesMap = normalizeArrayToMapFunc(
		playingPieceInstances ?? [],
		(p) => p.infinite?.infinitePieceId
	)

	const wrapPiece = (p: PieceInstancePiece) => {
		const instance = rewrapPieceToInstance(p, playlistActivationId, part.rundownId, newInstanceId, isTemporary)

		if (instance.piece.lifespan !== PieceLifespan.WithinPart) {
			const existingPiece = nextPartIsAfterCurrentPart
				? playingPieceInstancesMap.get(instance.piece._id)
				: undefined
			instance.infinite = {
				infiniteInstanceId: existingPiece?.infinite?.infiniteInstanceId ?? getRandomId(),
				infiniteInstanceIndex: (existingPiece?.infinite?.infiniteInstanceIndex ?? -1) + 1,
				infinitePieceId: instance.piece._id,
				fromPreviousPart: false, // Set below
			}

			instance.infinite.fromPreviousPart = instance.piece.startPartId !== part._id
			if (existingPiece && (instance.piece.startPartId !== part._id || instance.dynamicallyInserted)) {
				// If it doesnt start in this part, then mark it as a continuation
				markPieceInstanceAsContinuation(existingPiece, instance)
			}

			if (instance.infinite.fromPreviousPart) {
				// If this is not the start point, it should start at 0
				// Note: this should not be setitng fromPreviousPlayhead, as it is not from the playhead
				instance.piece = {
					...instance.piece,
					enable: {
						start: 0,
					},
				}
			}
		}

		return instance
	}

	const normalPieces = possiblePieces.filter((p) => p.startPartId === part._id)
	const result = normalPieces.map(wrapPiece).concat(infinitesFromPrevious)
	for (const pieceSet of Array.from(piecesOnSourceLayers.values())) {
		const onEndPieces = _.compact([
			pieceSet[PieceLifespan.OutOnShowStyleEnd],
			pieceSet[PieceLifespan.OutOnRundownEnd],
			pieceSet[PieceLifespan.OutOnSegmentEnd],
		])
		result.push(...onEndPieces.map(wrapPiece))

		// if (pieceSet.onChange) {
		// 	result.push(rewrapInstance(pieceSet.onChange))
		// }
	}

	return result
}

export function isCandidateMoreImportant(best: PieceInstance, candidate: PieceInstance): boolean | undefined {
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
	if (best.dynamicallyInserted && candidate.dynamicallyInserted) {
		// prefer the one which starts later
		return best.dynamicallyInserted < candidate.dynamicallyInserted
	} else if (best.dynamicallyInserted) {
		// Prefer the adlib
		return false
	} else if (candidate.dynamicallyInserted) {
		// Prefer the adlib
		return true
	} else {
		// Neither are adlibs, try other things
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

	return undefined
}

export function isCandidateBetterToBeContinued(best: PieceInstance, candidate: PieceInstance): boolean {
	// Fallback to id, as we dont have any other criteria and this will be stable.
	// Note: we shouldnt even get here, as it shouldnt be possible for multiple to start at the same time, but it is possible
	return isCandidateMoreImportant(best, candidate) ?? best.piece._id < candidate.piece._id
}

function continueShowStyleEndInfinites(
	rundownsBeforeThisInPlaylist: RundownId[],
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	previousRundownId: RundownId,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>
): boolean {
	let canContinueShowStyleEndInfinites = true
	if (rundown.showStyleBaseId !== rundownsToShowstyles.get(previousRundownId)) {
		canContinueShowStyleEndInfinites = false
	} else {
		const targetShowStyle = rundown.showStyleBaseId
		canContinueShowStyleEndInfinites = rundownsBeforeThisInPlaylist
			.slice(rundownsBeforeThisInPlaylist.indexOf(previousRundownId))
			.every((r) => rundownsToShowstyles.get(r) === targetShowStyle)
	}

	return canContinueShowStyleEndInfinites
}
