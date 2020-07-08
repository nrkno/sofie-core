import _ from 'underscore'
import { PartInstance, PartInstanceId } from '../collections/PartInstances'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../collections/PieceInstances'
import { DBPart, PartId, Part } from '../collections/Parts'
import { Piece } from '../collections/Pieces'
import { SegmentId } from '../collections/Segments'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { assertNever, max, flatten } from '../lib'
import { Mongo } from 'meteor/mongo'

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
	// const playingPartIndex = playingPartInstance
	// 	? orderedParts.findIndex((p) => p._id === playingPartInstance.part._id)
	// 	: undefined // TODO-INFINITES this will want refining once we define the selectNext behaviour
	// const newPartIndex = orderedParts.findIndex((p) => p._id === part._id)

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
					(p) => p.infinite?.fromPrevious || p.dynamicallyInserted
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
								segmentsBeforeThisInRundownSet.has(currentPartInstance.segmentId)
							break
					}

					if (isValid) {
						// we need to check it should be masked by another infinite
						const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? {}
						const currentPiece = pieceSet[mode]
						if (currentPiece) {
							// Which should we use?
							// TODO-INFINITES when should the adlib take priority over preprogrammed?
						} else {
							// There isnt a conflict, so its easy
							pieceSet[mode] = candidatePiece
							piecesOnSourceLayers.set(sourceLayerId, pieceSet)
						}
					}
				}
			}
		}
	}

	const rewrapInstance = (p: PieceInstance) => {
		const instance = rewrapPieceToInstance(p.piece, part.rundownId, newInstanceId, isTemporary)

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
				fromPrevious: true,
			}
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
			return (
				pieceToCheck.startRundownId === part.rundownId &&
				segmentsBeforeThisInRundown.has(pieceToCheck.startSegmentId)
			)
		case PieceLifespan.OutOnSegmentChange:
			if (previousPartInstance === undefined) {
				// Predicting what will happen at arbitrary point in the future
				return (
					pieceToCheck.startSegmentId === part.segmentId &&
					partsBeforeThisInSegment.has(pieceToCheck.startPartId)
				)
			} else {
				// TODO-INFINITES
				return false
				// return (
				// 	(pieceToCheck.startSegmentId === segment._id &&
				// 		playHead.partId === part && // we're checking in t	he currently-playing part
				// 			pieceToCheck.startPartRank >= part._rank) ||
				// 	(nextHead.segmentId === segment && // We're checking the currently-playing segment
				// 		pieceToCheck.rank >= nextHead.partRank &&
				// 		part.rank < playHead.partRank) ||
				// 	(nextHead.partId !== part &&
				// 		pieceToCheck.startSegmentId === segment._id &&
				// 		pieceToCheck.startPartRank >= part._rank)
				// )
			}
		case PieceLifespan.OutOnRundownChange:
			if (previousPartInstance === undefined) {
				// Predicting what will happen at arbitrary point in the future
				return (
					pieceToCheck.startRundownId === part.rundownId &&
					segmentsBeforeThisInRundown.has(pieceToCheck.startSegmentId)
				)
			} else {
				// TODO-INFINITES
				return false
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
	//    // IN the GUI
	//    /*
	//     if (I want to view the Part as-played) {
	//        display latest PartInstance
	//     } else {
	//         Display "how it's going to look like, when it'll be played next time (by only doing TAKE:S) "
	//     }
	//    */

	// TODO - this is also generated above..

	// const partMap = normalizeArray(orderedParts, '_id')
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

	// Prune any on layers where the normalPiece starts at 0
	const normalPieces = possiblePieces.filter((p) => p.startPartId === part._id)
	// TODO-INFINITES - this would be nicer to do from the playout/ui logic
	// for (const normalPiece of normalPieces) {
	// 	if (normalPiece.enable.start === 0) {
	// 		const pieceSet = piecesOnSourceLayers.get(normalPiece.sourceLayerId) ?? {}
	// 		// If an onChange starts at 0, then we will replace it.
	// 		// onEnd can't can only be overridden, so dont prune those
	// 		delete pieceSet['onChange']
	// 		// TODO - fix
	// 	}
	// }

	// Compile the resulting list

	const wrapPiece = (p: PieceInstancePiece) => {
		const instance = rewrapPieceToInstance(p, part.rundownId, newInstanceId, isTemporary)

		if (!instance.infinite && instance.piece.lifespan !== PieceLifespan.WithinPart) {
			instance.infinite = {
				infinitePieceId: instance.piece._id,
			}
		}
		if (instance.infinite && instance.piece.startPartId !== part._id) {
			// If this is not the start point, it should start at 0
			instance.piece = {
				...instance.piece,
				enable: {
					start: 0,
				},
			}
		}

		return instance
	}

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
