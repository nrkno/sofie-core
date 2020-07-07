import * as _ from 'underscore'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { DBPart, Part } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { asyncCollectionFindFetch } from '../../../lib/lib'
import { PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getAllOrderedPartsFromCache, selectNextPart, getSelectedPartInstancesFromCache } from './lib'
import { CacheForRundownPlaylist } from '../../DatabaseCaches'
import { saveIntoCache } from '../../DatabaseCache'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
} from '../../../lib/rundown/infinites'

// /** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
// const DEFINITELY_ENDED_FUTURE_DURATION = 10 * 1000

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

export async function fetchPiecesThatMayBeActiveForPart(
	cache: CacheForRundownPlaylist,
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

		console.log(infinites)

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
	// TODO - this is also generated above..
	const partsBeforeThisInSegmentSet = new Set(
		cache.Parts.findFetch({
			segmentId: nextPartInstance.segmentId,
			_rank: { $lt: nextPartInstance.part._rank }, // TODO-INFINITES is this ok?
		}).map((p) => p._id)
	)
	const currentSegment = cache.Segments.findOne(nextPartInstance.segmentId)
	const segmentsBeforeThisInRundownSet = new Set(
		currentSegment
			? cache.Segments.findFetch({
					rundownId: nextPartInstance.rundownId,
					_rank: { $lt: currentSegment._rank },
			  }).map((p) => p._id)
			: []
	)
	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(playlist, orderedParts, playingPartInstance, part)
	const playingPieceInstances = cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)

	return libgetPlayheadTrackingInfinitesForPart(
		partsBeforeThisInSegmentSet,
		segmentsBeforeThisInRundownSet,
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

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)
	const playingPieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(playlist, orderedParts, playingPartInstance, part)

	return libgetPieceInstancesForPart(
		playingPartInstance,
		playingPieceInstances,
		part,
		partsBeforeThisInSegmentSet,
		segmentsBeforeThisInRundownSet,
		possiblePieces,
		orderedParts,
		newInstanceId,
		canContinueAdlibOnEnds,
		isTemporary
	)
}
