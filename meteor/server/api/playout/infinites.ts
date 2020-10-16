import * as _ from 'underscore'
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
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '../../../lib/rundown/infinites'
import { profiler } from '../profiler'

// /** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

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
		const span = profiler.startSpan('canContinueAdlibOnEndInfinites')
		// TODO - if we don't have an index for previousPartInstance, what should we do?

		const expectedNextPart = selectNextPart(playlist, previousPartInstance, orderedParts)
		if (expectedNextPart) {
			if (expectedNextPart.part._id === part._id) {
				// Next part is what we expect, so take it
				return true
			} else {
				const partIndex = orderedParts.findIndex((p) => p._id === part._id)
				if (partIndex >= expectedNextPart.index) {
					if (span) span.end()
					// Somewhere after the auto-next part, so we can use that
					return true
				} else {
					if (span) span.end()
					// It isnt ahead, so we cant take it
					return false
				}
			}
		} else {
			if (span) span.end()
			// selectNextPart gave nothing, so we must be at the end?
			return false
		}
	} else {
		// There won't be anything to continue anyway..
		return false
	}
}

function getIdsBeforeThisPart(cache: CacheForRundownPlaylist, nextPart: DBPart) {
	const span = profiler.startSpan('getIdsBeforeThisPart')
	// Note: This makes the assumption that nextPart is a part found in this cache
	const partsBeforeThisInSegment = cache.Parts.findFetch({
		segmentId: nextPart.segmentId,
		_rank: { $lt: nextPart._rank },
	}).map((p) => p._id)
	const currentSegment = cache.Segments.findOne(nextPart.segmentId)
	const segmentsBeforeThisInRundown = currentSegment
		? cache.Segments.findFetch({
				rundownId: nextPart.rundownId,
				_rank: { $lt: currentSegment._rank },
		  }).map((p) => p._id)
		: []

	if (span) span.end()
	return {
		partsBeforeThisInSegment,
		segmentsBeforeThisInRundown,
	}
}

export async function fetchPiecesThatMayBeActiveForPart(
	cache: CacheForRundownPlaylist,
	part: DBPart
): Promise<Piece[]> {
	const span = profiler.startSpan('fetchPiecesThatMayBeActiveForPart')

	const thisPiecesQuery = buildPiecesStartingInThisPartQuery(part)
	const pPiecesStartingInPart = cache.Pieces.initialized
		? Promise.resolve(cache.Pieces.findFetch(thisPiecesQuery))
		: asyncCollectionFindFetch(Pieces, thisPiecesQuery)

	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const infinitePiecesQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsBeforeThisInSegment,
		segmentsBeforeThisInRundown
	)
	const pInfinitePieces = cache.Pieces.initialized
		? Promise.resolve(cache.Pieces.findFetch(infinitePiecesQuery))
		: asyncCollectionFindFetch(Pieces, infinitePiecesQuery)

	const [piecesStartingInPart, infinitePieces] = await Promise.all([pPiecesStartingInPart, pInfinitePieces])
	if (span) span.end()
	return [...piecesStartingInPart, ...infinitePieces]
}

export function syncPlayheadInfinitesForNextPartInstance(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist
): void {
	const span = profiler.startSpan('syncPlayheadInfinitesForNextPartInstance')
	const { nextPartInstance, currentPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
	if (nextPartInstance && currentPartInstance) {
		const infinites = getPlayheadTrackingInfinitesForPart(cache, playlist, currentPartInstance, nextPartInstance)

		saveIntoCache(
			cache.PieceInstances,
			{
				partInstanceId: nextPartInstance._id,
				'infinite.fromPreviousPlayhead': true,
			},
			infinites
		)
	}
	if (span) span.end()
}

function getPlayheadTrackingInfinitesForPart(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	playingPartInstance: PartInstance,
	nextPartInstance: PartInstance
): PieceInstance[] {
	const span = profiler.startSpan('getPlayheadTrackingInfinitesForPart')
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, nextPartInstance.part)

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
		playlist,
		orderedParts,
		playingPartInstance,
		nextPartInstance.part
	)
	const playingPieceInstances = cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)

	const res = libgetPlayheadTrackingInfinitesForPart(
		new Set(partsBeforeThisInSegment),
		new Set(segmentsBeforeThisInRundown),
		playingPartInstance,
		playingPieceInstances,
		nextPartInstance.part,
		nextPartInstance._id,
		canContinueAdlibOnEnds,
		false
	)
	if (span) span.end()
	return res
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
	const span = profiler.startSpan('getPieceInstancesForPart')
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)
	const playingPieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(playlist, orderedParts, playingPartInstance, part)

	const res = libgetPieceInstancesForPart(
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
	if (span) span.end()
	return res
}
