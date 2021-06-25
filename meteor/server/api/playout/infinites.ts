import * as _ from 'underscore'
import { DBPart } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'
import { PartInstance, PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartsAndSegments, selectNextPart } from './lib'
import { saveIntoCache } from '../../cache/lib'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
	processAndPrunePieceInstanceTimings,
} from '../../../lib/rundown/infinites'
import { profiler } from '../profiler'
import { Meteor } from 'meteor/meteor'
import { CacheForPlayout, getOrderedSegmentsAndPartsFromPlayoutCache, getSelectedPartInstancesFromCache } from './cache'
import { ReadonlyDeep } from 'type-fest'
import { asyncCollectionFindFetch } from '../../lib/database'
import { getCurrentTime } from '../../../lib/lib'
import { CacheForIngest } from '../ingest/cache'
import { ReadOnlyCache } from '../../cache/CacheBase'

// /** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
function canContinueAdlibOnEndInfinites(
	playlist: ReadonlyDeep<RundownPlaylist>,
	orderedPartsAndSegments: PartsAndSegments,
	previousPartInstance: PartInstance | undefined,
	part: DBPart
): boolean {
	if (previousPartInstance && playlist) {
		const span = profiler.startSpan('canContinueAdlibOnEndInfinites')
		// TODO - if we don't have an index for previousPartInstance, what should we do?

		const expectedNextPart = selectNextPart(playlist, previousPartInstance, orderedPartsAndSegments)
		if (expectedNextPart) {
			if (expectedNextPart.part._id === part._id) {
				// Next part is what we expect, so take it
				return true
			} else {
				const partIndex = orderedPartsAndSegments.parts.findIndex((p) => p._id === part._id)
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

function getIdsBeforeThisPart(cache: CacheForPlayout, nextPart: DBPart) {
	const span = profiler.startSpan('getIdsBeforeThisPart')
	// Get the normal parts
	const partsBeforeThisInSegment = cache.Parts.findFetch(
		(p) => p.segmentId === nextPart.segmentId && p._rank < nextPart._rank
	)
	// Find any orphaned parts
	const partInstancesBeforeThisInSegment = cache.PartInstances.findFetch(
		(p) => p.segmentId === nextPart.segmentId && p.orphaned && p.part._rank < nextPart._rank
	)
	partsBeforeThisInSegment.push(...partInstancesBeforeThisInSegment.map((p) => p.part))

	const currentSegment = cache.Segments.findOne(nextPart.segmentId)
	const segmentsBeforeThisInRundown = currentSegment
		? cache.Segments.findFetch({
				rundownId: nextPart.rundownId,
				_rank: { $lt: currentSegment._rank },
		  }).map((p) => p._id)
		: []

	if (span) span.end()
	return {
		partsBeforeThisInSegment: _.sortBy(partsBeforeThisInSegment, (p) => p._rank).map((p) => p._id),
		segmentsBeforeThisInRundown,
	}
}

export async function fetchPiecesThatMayBeActiveForPart(
	cache: CacheForPlayout,
	unsavedIngestCache: Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'> | undefined,
	part: DBPart
): Promise<Piece[]> {
	const span = profiler.startSpan('fetchPiecesThatMayBeActiveForPart')

	const thisPiecesQuery = buildPiecesStartingInThisPartQuery(part)
	const pPiecesStartingInPart =
		unsavedIngestCache?.RundownId === part.rundownId
			? Promise.resolve(unsavedIngestCache.Pieces.findFetch(thisPiecesQuery))
			: asyncCollectionFindFetch(Pieces, thisPiecesQuery)

	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const infinitePiecesQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsBeforeThisInSegment,
		segmentsBeforeThisInRundown
	)
	// Future scope: Once there is a longer than Rundown infinite mode, this will need to split the query to search everywhere
	const pInfinitePieces =
		unsavedIngestCache?.RundownId === part.rundownId
			? Promise.resolve(unsavedIngestCache.Pieces.findFetch(infinitePiecesQuery))
			: asyncCollectionFindFetch(Pieces, infinitePiecesQuery)

	const [piecesStartingInPart, infinitePieces] = await Promise.all([pPiecesStartingInPart, pInfinitePieces])
	if (span) span.end()
	return [...piecesStartingInPart, ...infinitePieces]
}

export async function syncPlayheadInfinitesForNextPartInstance(cache: CacheForPlayout): Promise<void> {
	const span = profiler.startSpan('syncPlayheadInfinitesForNextPartInstance')
	const { nextPartInstance, currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (nextPartInstance && currentPartInstance) {
		const playlist = cache.Playlist.doc
		if (!playlist.activationId) throw new Meteor.Error(500, `RundownPlaylist "${playlist._id}" is not active`)

		const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(
			cache,
			nextPartInstance.part
		)

		const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${currentPartInstance.rundownId}" not found!`)

		// !! Database call !!
		const showStyleBase = await cache.activationCache.getShowStyleBase(rundown)

		const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

		const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
			playlist,
			orderedPartsAndSegments,
			currentPartInstance,
			nextPartInstance.part
		)
		const playingPieceInstances = cache.PieceInstances.findFetch(
			(p) => p.partInstanceId === currentPartInstance._id
		)

		const nowInPart = getCurrentTime() - (currentPartInstance.timings?.startedPlayback ?? 0)
		const prunedPieceInstances = processAndPrunePieceInstanceTimings(
			showStyleBase,
			playingPieceInstances,
			nowInPart,
			undefined,
			true
		)

		const infinites = libgetPlayheadTrackingInfinitesForPart(
			playlist.activationId,
			new Set(partsBeforeThisInSegment),
			new Set(segmentsBeforeThisInRundown),
			currentPartInstance,
			prunedPieceInstances,
			nextPartInstance.part,
			nextPartInstance._id,
			canContinueAdlibOnEnds,
			false
		)

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

export function getPieceInstancesForPart(
	cache: CacheForPlayout,
	playingPartInstance: PartInstance | undefined,
	part: DBPart,
	possiblePieces: Piece[],
	newInstanceId: PartInstanceId,
	isTemporary: boolean
): PieceInstance[] {
	const span = profiler.startSpan('getPieceInstancesForPart')
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown } = getIdsBeforeThisPart(cache, part)

	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw new Meteor.Error(500, `RundownPlaylist "${playlist._id}" is not active`)

	const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
	const playingPieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
		playlist,
		orderedPartsAndSegments,
		playingPartInstance,
		part
	)

	const res = libgetPieceInstancesForPart(
		playlist.activationId,
		playingPartInstance,
		playingPieceInstances,
		part,
		new Set(partsBeforeThisInSegment),
		new Set(segmentsBeforeThisInRundown),
		possiblePieces,
		orderedPartsAndSegments.parts.map((p) => p._id),
		newInstanceId,
		canContinueAdlibOnEnds,
		isTemporary
	)
	if (span) span.end()
	return res
}
