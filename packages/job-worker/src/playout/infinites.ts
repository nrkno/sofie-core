import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { JobContext } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getSelectedPartInstancesFromCache,
	getShowStyleIdsRundownMappingFromCache,
} from './cache'
import { getCurrentTime } from '../lib'
import { saveIntoCache } from '../cache/lib'
import { PartsAndSegments, selectNextPart } from './lib'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { flatten } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
function canContinueAdlibOnEndInfinites(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	orderedPartsAndSegments: PartsAndSegments,
	previousPartInstance: DBPartInstance | undefined,
	part: DBPart
): boolean {
	if (previousPartInstance && playlist) {
		const span = context.startSpan('canContinueAdlibOnEndInfinites')
		// TODO - if we don't have an index for previousPartInstance, what should we do?

		const expectedNextPart = selectNextPart(context, playlist, previousPartInstance, orderedPartsAndSegments)
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

function getIdsBeforeThisPart(context: JobContext, cache: CacheForPlayout, nextPart: DBPart) {
	const span = context.startSpan('getIdsBeforeThisPart')
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

	const currentRundown = cache.Rundowns.findOne(nextPart.rundownId)
	const rundownsBeforeThisInPlaylist = currentRundown
		? cache.Rundowns.findFetch({ playlistId: cache.Playlist.doc._id, _rank: { $lt: currentRundown._rank } }).map(
				(p) => p._id
		  )
		: []

	if (span) span.end()
	return {
		partsBeforeThisInSegment: _.sortBy(partsBeforeThisInSegment, (p) => p._rank).map((p) => p._id),
		segmentsBeforeThisInRundown,
		rundownsBeforeThisInPlaylist,
	}
}

export async function fetchPiecesThatMayBeActiveForPart(
	context: JobContext,
	cache: CacheForPlayout,
	unsavedIngestCache: any, // Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'> | undefined, // TODO
	part: DBPart
): Promise<Piece[]> {
	const span = context.startSpan('fetchPiecesThatMayBeActiveForPart')

	const piecePromises: Array<Promise<Array<Piece>> | Array<Piece>> = []

	// Find all the pieces starting in the part
	const thisPiecesQuery = buildPiecesStartingInThisPartQuery(part)
	piecePromises.push(
		unsavedIngestCache?.RundownId === part.rundownId
			? unsavedIngestCache.Pieces.findFetch(thisPiecesQuery)
			: context.directCollections.Pieces.findFetch(thisPiecesQuery)
	)

	// Figure out the ids of everything else we will have to search through
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown, rundownsBeforeThisInPlaylist } =
		getIdsBeforeThisPart(context, cache, part)

	if (unsavedIngestCache?.RundownId === part.rundownId) {
		// Find pieces for the current rundown
		const thisRundownPieceQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsBeforeThisInSegment,
			segmentsBeforeThisInRundown,
			[] // other rundowns don't exist in the ingestCache
		)
		if (thisRundownPieceQuery) {
			piecePromises.push(unsavedIngestCache.Pieces.findFetch(thisRundownPieceQuery))
		}

		// Find pieces for the previous rundowns
		const previousRundownPieceQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			[], // Only applies to the current rundown
			[], // Only applies to the current rundown
			rundownsBeforeThisInPlaylist
		)
		if (previousRundownPieceQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(previousRundownPieceQuery))
		}
	} else {
		// No cache, so we can do a single query to the db for it all
		const infinitePiecesQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsBeforeThisInSegment,
			segmentsBeforeThisInRundown,
			rundownsBeforeThisInPlaylist
		)
		if (infinitePiecesQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(infinitePiecesQuery))
		}
	}

	const pieces = flatten(await Promise.all(piecePromises))
	if (span) span.end()
	return pieces
}

export async function syncPlayheadInfinitesForNextPartInstance(
	context: JobContext,
	cache: CacheForPlayout
): Promise<void> {
	const span = context.startSpan('syncPlayheadInfinitesForNextPartInstance')
	const { nextPartInstance, currentPartInstance } = getSelectedPartInstancesFromCache(cache)
	if (nextPartInstance && currentPartInstance) {
		const playlist = cache.Playlist.doc
		if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

		const { partsBeforeThisInSegment, segmentsBeforeThisInRundown, rundownsBeforeThisInPlaylist } =
			getIdsBeforeThisPart(context, cache, nextPartInstance.part)

		const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
		if (!rundown) throw new Error(`Rundown "${currentPartInstance.rundownId}" not found!`)

		// !! Database call !!
		const showStyleBase = await context.directCollections.ShowStyleBases.findOne(rundown.showStyleBaseId) // await cache.activationCache.getShowStyleBase(rundown) // HACK
		if (!showStyleBase) throw new Error('Failed to load showStyleBAse') // HACK

		const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

		const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
			context,
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

		const rundownIdsToShowstyleIds = getShowStyleIdsRundownMappingFromCache(cache)

		const infinites = libgetPlayheadTrackingInfinitesForPart(
			playlist.activationId,
			new Set(partsBeforeThisInSegment),
			new Set(segmentsBeforeThisInRundown),
			rundownsBeforeThisInPlaylist,
			rundownIdsToShowstyleIds,
			currentPartInstance,
			prunedPieceInstances,
			rundown,
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
	context: JobContext,
	cache: CacheForPlayout,
	playingPartInstance: DBPartInstance | undefined,
	rundown: ReadonlyDeep<DBRundown>,
	part: DBPart,
	possiblePieces: Piece[],
	newInstanceId: PartInstanceId,
	isTemporary: boolean
): PieceInstance[] {
	const span = context.startSpan('getPieceInstancesForPart')
	const { partsBeforeThisInSegment, segmentsBeforeThisInRundown, rundownsBeforeThisInPlaylist } =
		getIdsBeforeThisPart(context, cache, part)

	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

	const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)
	const playingPieceInstances = playingPartInstance
		? cache.PieceInstances.findFetch((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
		context,
		playlist,
		orderedPartsAndSegments,
		playingPartInstance,
		part
	)

	const rundownIdsToShowstyleIds = getShowStyleIdsRundownMappingFromCache(cache)

	const res = libgetPieceInstancesForPart(
		playlist.activationId,
		playingPartInstance,
		playingPieceInstances,
		rundown,
		part,
		new Set(partsBeforeThisInSegment),
		new Set(segmentsBeforeThisInRundown),
		rundownsBeforeThisInPlaylist,
		rundownIdsToShowstyleIds,
		possiblePieces,
		orderedPartsAndSegments.parts.map((p) => p._id),
		newInstanceId,
		canContinueAdlibOnEnds,
		isTemporary
	)
	if (span) span.end()
	return res
}
