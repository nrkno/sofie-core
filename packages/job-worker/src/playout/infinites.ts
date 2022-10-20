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
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { flatten } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { ReadOnlyCache } from '../cache/CacheBase'
import { CacheForIngest } from '../ingest/cache'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
export function canContinueAdlibOnEndInfinites(
	_context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	orderedSegments: DBSegment[],
	previousPartInstance: DBPartInstance | undefined,
	candidateInstance: DBPart
): boolean {
	if (previousPartInstance && playlist) {
		// When in the same segment, we can rely on the ranks to be in order. This is to handle orphaned parts, but is also valid for normal parts
		if (candidateInstance.segmentId === previousPartInstance.segmentId) {
			return candidateInstance._rank > previousPartInstance.part._rank
		} else {
			// Check if the segment is after the other
			const previousSegmentIndex = orderedSegments.findIndex((s) => s._id === previousPartInstance.segmentId)
			const candidateSegmentIndex = orderedSegments.findIndex((s) => s._id === candidateInstance.segmentId)

			if (previousSegmentIndex === -1 || candidateSegmentIndex === -1) {
				// Should never happen, as orphaned segments are kept around
				return false
			}

			return candidateSegmentIndex >= previousSegmentIndex
		}
	} else {
		// There won't be anything to continue anyway..
		return false
	}
}

function getIdsBeforeThisPart(context: JobContext, cache: CacheForPlayout, nextPart: DBPart) {
	const span = context.startSpan('getIdsBeforeThisPart')
	// Get the normal parts
	const partsBeforeThisInSegment = cache.Parts.findAll(
		(p) => p.segmentId === nextPart.segmentId && p._rank < nextPart._rank
	)
	// Find any orphaned parts
	const partInstancesBeforeThisInSegment = cache.PartInstances.findAll(
		(p) => p.segmentId === nextPart.segmentId && !!p.orphaned && p.part._rank < nextPart._rank
	)
	partsBeforeThisInSegment.push(...partInstancesBeforeThisInSegment.map((p) => p.part))

	const currentSegment = cache.Segments.findOne(nextPart.segmentId)
	const segmentsBeforeThisInRundown = currentSegment
		? cache.Segments.findAll((s) => s.rundownId === nextPart.rundownId && s._rank < currentSegment._rank).map(
				(p) => p._id
		  )
		: []

	const sortedRundownIds = sortRundownIDsInPlaylist(
		cache.Playlist.doc.rundownIdsInOrder,
		cache.Rundowns.findAll(null).map((rd) => rd._id)
	)
	const currentRundownIndex = sortedRundownIds.indexOf(nextPart.rundownId)
	const rundownsBeforeThisInPlaylist =
		currentRundownIndex === -1 ? [] : sortedRundownIds.slice(0, currentRundownIndex)

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
	unsavedIngestCache: Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'> | undefined,
	part: DBPart
): Promise<Piece[]> {
	const span = context.startSpan('fetchPiecesThatMayBeActiveForPart')

	const piecePromises: Array<Promise<Array<Piece>> | Array<Piece>> = []

	// Find all the pieces starting in the part
	const thisPiecesQuery = buildPiecesStartingInThisPartQuery(part)
	piecePromises.push(
		unsavedIngestCache?.RundownId === part.rundownId
			? unsavedIngestCache.Pieces.findAll((p) => mongoWhere(p, thisPiecesQuery))
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
			piecePromises.push(unsavedIngestCache.Pieces.findAll((p) => mongoWhere(p, thisRundownPieceQuery)))
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

		const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)

		const orderedPartsAndSegments = getOrderedSegmentsAndPartsFromPlayoutCache(cache)

		const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
			context,
			playlist,
			orderedPartsAndSegments.segments,
			currentPartInstance,
			nextPartInstance.part
		)
		const playingPieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === currentPartInstance._id)

		const nowInPart = getCurrentTime() - (currentPartInstance.timings?.plannedStartedPlayback ?? 0)
		const prunedPieceInstances = processAndPrunePieceInstanceTimings(
			showStyleBase.sourceLayers,
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
			context,
			cache.PieceInstances,
			(p) => p.partInstanceId === nextPartInstance._id && !!p.infinite?.fromPreviousPlayhead,
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
		? cache.PieceInstances.findAll((p) => p.partInstanceId === playingPartInstance._id)
		: []

	const canContinueAdlibOnEnds = canContinueAdlibOnEndInfinites(
		context,
		playlist,
		orderedPartsAndSegments.segments,
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
