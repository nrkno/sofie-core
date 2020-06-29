import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { PieceLifespan, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Part, PartId, DBPart } from '../../../lib/collections/Parts'
import { syncFunction } from '../../codeControl'
import { Piece, PieceId, Pieces } from '../../../lib/collections/Pieces'
import {
	asyncCollectionUpdate,
	waitForPromiseAll,
	asyncCollectionRemove,
	asyncCollectionInsert,
	makePromise,
	waitForPromise,
	asyncCollectionFindFetch,
	literal,
	protectString,
	unprotectObject,
	getCurrentTime,
	assertNever,
	unprotectString,
} from '../../../lib/lib'
import { PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import {
	PieceInstance,
	wrapPieceToInstance,
	PieceInstances,
	wrapPieceToTemporaryInstance,
	rewrapPieceToInstance,
	PieceInstancePiece,
} from '../../../lib/collections/PieceInstances'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import {
	getSelectedPartInstancesFromCache,
	getAllPieceInstancesFromCache,
	getRundownsSegmentsAndPartsFromCache,
	getRundownsFromCache,
	getAllOrderedPartsFromCache,
} from './lib'
import { SegmentId, Segment } from '../../../lib/collections/Segments'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
const DEFINITELY_ENDED_FUTURE_DURATION = 10 * 1000

export async function fetchPiecesThatMayBeActiveForPart(
	cache: CacheForRundownPlaylist,
	// rundown: Rundown,
	// segment: Segment,
	// playingPartInstance: PartInstance | undefined,
	part: DBPart
): Promise<Piece[]> {
	const pPiecesStartingInPart = asyncCollectionFindFetch(Pieces, { startPartId: part._id })

	const partsBeforeThisInSegment = cache.Parts.findFetch({ segmentId: part.segmentId, _rank: { $lt: part._rank } })
	const currentSegment = cache.Segments.findOne(part.segmentId)
	const segmentsBeforeThisInRundown = currentSegment
		? cache.Segments.findFetch({
				rundownId: part.rundownId,
				_rank: { $lt: currentSegment._rank },
		  })
		: []

	const pInfinitePieces = asyncCollectionFindFetch(Pieces, {
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
				startPartId: { $in: partsBeforeThisInSegment.map((p) => p._id) },
			},
			{
				// same rundown, and previous segment
				lifespan: { $in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange] },
				startRundownId: part.rundownId,
				startSegmentId: { $in: segmentsBeforeThisInRundown.map((p) => p._id) },
			},
			// {
			// 	// previous rundown
			//  // Potential future scope
			// }
		],
	})

	// const pieceInstancesInPrevious = playingPartInstance
	// 	? cache.PieceInstances.findFetch({
	// 			'piece.lifespan': {
	// 				$in: [PieceLifespan.OutOnRundownChange, PieceLifespan.OutOnSegmentChange],
	// 			},
	// 			partInstanceId: playingPartInstance._id,
	// 	  })
	// 	: []

	const [piecesStartingInPart, infinitePieces] = await Promise.all([pPiecesStartingInPart, pInfinitePieces])

	return [...piecesStartingInPart, ...infinitePieces]
}

export function getPieceInstancesForPart(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	playingPartInstance: PartInstance | undefined,
	part: DBPart,
	possiblePieces: Piece[],
	newInstanceId: PartInstanceId,
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
	const partsBeforeThisInSegmentSet = new Set(
		cache.Parts.findFetch({ segmentId: part.segmentId, _rank: { $lt: part._rank } }).map((p) => p._id)
	)
	const currentSegment = cache.Segments.findOne(part.segmentId)
	const segmentsBeforeThisInRundownSet = new Set(
		currentSegment
			? cache.Segments.findFetch({
					rundownId: part.rundownId,
					_rank: { $lt: currentSegment._rank },
			  }).map((p) => p._id)
			: []
	)

	const wrapPiece = (p: PieceInstancePiece) => {
		const instance = rewrapPieceToInstance(p, part.rundownId, newInstanceId, isTemporary)

		if (!instance.infinite && instance.piece.lifespan !== PieceLifespan.WithinPart) {
			instance.infinite = {
				infinitePieceId: instance.piece._id,
			}
		}

		return instance
	}

	const rewrapInstance = (p: PieceInstance) => {
		const instance = rewrapPieceToInstance(p.piece, part.rundownId, newInstanceId, isTemporary)

		instance.infinite = p.infinite

		return instance
	}

	const orderedPartIds = getAllOrderedPartsFromCache(cache, playlist).map((p) => p._id)
	const doesPieceAStartBeforePieceB = (pieceA: Piece, pieceB: Piece): boolean => {
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

	// Filter down to the last starting onEnd infinite per layer
	const piecesOnSourceLayers: { [sourceLayerId: string]: Piece } = {}
	const infinitePieces = possiblePieces.filter(
		(p) =>
			p.startPartId !== part._id &&
			(p.lifespan === PieceLifespan.OutOnRundownEnd || p.lifespan === PieceLifespan.OutOnSegmentEnd)
	)
	for (const candidatePiece of infinitePieces) {
		const useIt = isPiecePotentiallyActiveInPart(
			playingPartInstance,
			partsBeforeThisInSegmentSet,
			segmentsBeforeThisInRundownSet,
			part,
			candidatePiece
		)

		if (useIt) {
			const existingPiece = piecesOnSourceLayers[candidatePiece.sourceLayerId]
			if (!existingPiece || doesPieceAStartBeforePieceB(existingPiece, candidatePiece)) {
				piecesOnSourceLayers[candidatePiece.sourceLayerId] = candidatePiece
			}
		}
	}

	// OnChange infinites take priority over onEnd, as they travel with the playhead
	const onChangePiecesOnSourceLayers: { [sourceLayerId: string]: PieceInstance } = {}
	const onChangePieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => {
				return (
					p.partInstanceId === playingPartInstance._id &&
					(p.piece.lifespan === PieceLifespan.OutOnRundownChange ||
						p.piece.lifespan === PieceLifespan.OutOnSegmentChange)
				)
		  })
		: []
	for (const onChangePiece of onChangePieceInstances) {
		delete piecesOnSourceLayers[onChangePiece.piece.sourceLayerId]
		onChangePiecesOnSourceLayers[onChangePiece.piece.sourceLayerId] = onChangePiece
	}

	// Prune any on layers where the normalPiece starts at 0
	const normalPieces = possiblePieces.filter((p) => p.startPartId === part._id)
	for (const normalPiece of normalPieces) {
		if (normalPiece.enable.start === 0) {
			delete piecesOnSourceLayers[normalPiece.sourceLayerId]
			delete onChangePiecesOnSourceLayers[normalPiece.sourceLayerId]
		}
	}

	return [
		...Object.values(piecesOnSourceLayers).map(wrapPiece),
		...Object.values(onChangePiecesOnSourceLayers).map(rewrapInstance),
		...normalPieces.map(wrapPiece),
	]
}

export function isPiecePotentiallyActiveInPart(
	previousPartInstance: PartInstance | undefined,
	partsBeforeThisInSegment: Set<PartId>,
	segmentsBeforeThisInRundown: Set<SegmentId>,
	part: DBPart,
	pieceToCheck: Piece
) {
	// If its from the current part
	if (pieceToCheck.startPartId === part._id) {
		return true
	}

	switch (pieceToCheck.lifespan) {
		case PieceLifespan.WithinPart:
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
