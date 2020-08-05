import * as _ from 'underscore'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { DBPart, Part } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { asyncCollectionFindFetch, literal, assertNever, extendMandadory } from '../../../lib/lib'
import { PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getAllOrderedPartsFromCache, selectNextPart, getSelectedPartInstancesFromCache } from './lib'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { saveIntoCache } from '../../DatabaseCache'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '../../../lib/rundown/infinites'

// /** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 10 * 1000

export interface PieceInstanceWithTimings extends PieceInstance {
	resolvedStart: number | 'now' // TODO - document that this is the value to use, not a bounds (and is identical to piece.enable.start)
	resolvedEndCap?: number | 'now' // TODO - document that this is value is a bounds, not the value to use
	priority: number
}

/**
 * Process the infinite pieces to determine the start time and a maximum end time for each.
 * Any pieces which have no chance of being shown (duplicate start times) are pruned
 * The stacking order of infinites is considered, to define the stop times
 */
export function processAndPrunePieceInstanceTimings(
	// partInstance: PartInstance,
	pieces: PieceInstance[],
	nowInPart: number
): PieceInstanceWithTimings[] {
	// TODO-INFINITE - use this for both the ui and backend
	// TODO It has not been tested yet, but I think the logic is reasonable

	const result: PieceInstanceWithTimings[] = []

	// TODO-INFINITE exclusiveGroup

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
				activePiece.resolvedEndCap = start
			}
			activePieces[key] = newPiece
			result.push(newPiece)

			if (activePieces.other) {
				if (key === 'onSegmentEnd' || (key === 'onRundownEnd' && !activePieces.onSegmentEnd)) {
					// These modes should stop the 'other' when they start if not hidden behind a high priority onEnd
					activePieces.other.resolvedEndCap = start
					activePieces.other = undefined
				}
			}
		}
	}

	const groupedPieces = _.groupBy(pieces, (p) => p.piece.sourceLayerId)
	for (const [slId, pieces] of Object.entries(groupedPieces)) {
		// Group and sort the pieces so that we can step through each point in time
		const piecesByStart: Array<[number | 'now', PieceInstance[]]> = _.sortBy(
			Object.entries(_.groupBy(pieces, (p) => p.piece.enable.start)).map(([k, v]) =>
				literal<[number | 'now', PieceInstance[]]>([k === 'now' ? 'now' : Number(k), v])
			),
			([k]) => (k === 'now' ? nowInPart : k)
		)

		const isClear = (piece?: PieceInstance): boolean => !!(piece?.dynamicallyInserted && piece?.piece.virtual)

		// Step through time
		activePieces = {}
		for (const [start, pieces] of piecesByStart) {
			const newPieces = findPieceInstancesOnInfiniteLayers(pieces)

			// Handle any clears
			if (isClear(newPieces.onSegmentEnd) && activePieces.onSegmentEnd) {
				activePieces.onSegmentEnd.resolvedEndCap = start
				activePieces.onSegmentEnd = newPieces.onSegmentEnd = undefined
			}
			if (isClear(newPieces.onRundownEnd) && activePieces.onRundownEnd) {
				activePieces.onRundownEnd.resolvedEndCap = start
				activePieces.onRundownEnd = newPieces.onRundownEnd = undefined
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
		if (best.infinite?.fromPrevious && !candidate.infinite?.fromPrevious) {
			// Prefer the candidate as it is not from previous
			return false
		}
		if (!best.infinite?.fromPrevious && candidate.infinite?.fromPrevious) {
			// Prefer the best as it is not from previous
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
						resolvedStart: piece.piece.enable.start,
					}
				}
				break
			case PieceLifespan.OutOnSegmentEnd:
				if (!res.onSegmentEnd || isCandidateBetter(res.onSegmentEnd, piece)) {
					res.onSegmentEnd = {
						...piece,
						priority: 2,
						resolvedStart: piece.piece.enable.start,
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
						resolvedStart: piece.piece.enable.start,
					}
				}
				break
			default:
				assertNever(piece.piece.lifespan)
		}
	}

	return res
}

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
function canContinueAdlibOnEndInfinites(
	playlist: RundownPlaylist,
	orderedParts: Part[],
	previousPartInstance: PartInstance | undefined,
	part: DBPart
): boolean {
	if (previousPartInstance && playlist) {
		// TODO - if we don't have an index for previousPartInstance, what should we do?

		const expectedNextPart = selectNextPart(playlist, previousPartInstance, orderedParts)
		if (expectedNextPart) {
			if (expectedNextPart.part._id === part._id) {
				// Next part is what we expect, so take it
				return true
			} else {
				const partIndex = orderedParts.findIndex((p) => p._id === part._id)
				if (partIndex >= expectedNextPart.index) {
					// Somewhere after the auto-next part, so we can use that
					return true
				} else {
					// It isnt ahead, so we cant take it
					return false
				}
			}
		} else {
			// selectNextPart gave nothing, so we must be at the end?
			return false
		}
	} else {
		// There won't be anything to continue anyway..
		return false
	}
}

function getIdsBeforeThisPart(cache: CacheForRundownPlaylist, nextPart: DBPart) {
	const partsBeforeThisInSegment = cache.Parts.findFetch({
		segmentId: nextPart.segmentId,
		_rank: { $lt: nextPart._rank }, // TODO-INFINITES is this ok?
	}).map((p) => p._id)
	const currentSegment = cache.Segments.findOne(nextPart.segmentId)
	const segmentsBeforeThisInRundown = currentSegment
		? cache.Segments.findFetch({
				rundownId: nextPart.rundownId,
				_rank: { $lt: currentSegment._rank },
		  }).map((p) => p._id)
		: []

	return {
		partsBeforeThisInSegment,
		segmentsBeforeThisInRundown,
	}
}

export async function fetchPiecesThatMayBeActiveForPart(
	cache: CacheForRundownPlaylist,
	part: DBPart
): Promise<Piece[]> {
	const pPiecesStartingInPart = asyncCollectionFindFetch(Pieces, buildPiecesStartingInThisPartQuery(part))

	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const pInfinitePieces = asyncCollectionFindFetch(
		Pieces,
		buildPastInfinitePiecesForThisPartQuery(part, partsBeforeThisInSegment, segmentsBeforeThisInRundown)
	)

	const [piecesStartingInPart, infinitePieces] = await Promise.all([pPiecesStartingInPart, pInfinitePieces])
	return [...piecesStartingInPart, ...infinitePieces]
}

export function syncPlayheadInfinitesForNextPartInstance(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist
): void {
	const { nextPartInstance, currentPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
	if (nextPartInstance && currentPartInstance) {
		const infinites = getPlayheadTrackingInfinitesForPart(cache, playlist, currentPartInstance, nextPartInstance)

		saveIntoCache(
			cache.PieceInstances,
			{
				partInstanceId: nextPartInstance._id,
				'infinite.fromPrevious': true,
			},
			infinites
		)
	}
}

function getPlayheadTrackingInfinitesForPart(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	playingPartInstance: PartInstance,
	nextPartInstance: PartInstance
): PieceInstance[] {
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, nextPartInstance.part)

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
		playlist,
		orderedParts,
		playingPartInstance,
		nextPartInstance.part
	)
	const playingPieceInstances = cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)

	return libgetPlayheadTrackingInfinitesForPart(
		new Set(partsBeforeThisInSegment),
		new Set(segmentsBeforeThisInRundown),
		playingPartInstance,
		playingPieceInstances,
		nextPartInstance.part,
		nextPartInstance._id,
		canContinueAdlibOnEnds,
		false
	)
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
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)
	const playingPieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(playlist, orderedParts, playingPartInstance, part)

	return libgetPieceInstancesForPart(
		playingPartInstance,
		playingPieceInstances,
		part,
		new Set(partsBeforeThisInSegment),
		new Set(segmentsBeforeThisInRundown),
		possiblePieces,
		orderedParts.map((part) => part._id),
		newInstanceId,
		canContinueAdlibOnEnds,
		isTemporary
	)
}
