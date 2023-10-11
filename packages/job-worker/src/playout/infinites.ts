import { PartInstanceId, RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { processAndPrunePieceInstanceTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { JobContext } from '../jobs'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel'
import { getCurrentTime } from '../lib'
import { flatten } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { ReadOnlyCache } from '../cache/CacheBase'
import { CacheForIngest } from '../ingest/cache'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import { PlayoutRundownModel } from './model/PlayoutRundownModel'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

function getShowStyleIdsRundownMapping(rundowns: readonly PlayoutRundownModel[]): Map<RundownId, ShowStyleBaseId> {
	const ret = new Map()

	for (const rundown of rundowns) {
		ret.set(rundown.Rundown._id, rundown.Rundown.showStyleBaseId)
	}

	return ret
}

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
export function candidatePartIsAfterPreviewPartInstance(
	_context: JobContext,
	orderedSegments: readonly PlayoutSegmentModel[],
	previousPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	candidateInstance: ReadonlyDeep<DBPart>
): boolean {
	if (previousPartInstance) {
		// When in the same segment, we can rely on the ranks to be in order. This is to handle orphaned parts, but is also valid for normal parts
		if (candidateInstance.segmentId === previousPartInstance.segmentId) {
			return candidateInstance._rank > previousPartInstance.part._rank
		} else {
			// Check if the segment is after the other
			const previousSegmentIndex = orderedSegments.findIndex(
				(s) => s.Segment._id === previousPartInstance.segmentId
			)
			const candidateSegmentIndex = orderedSegments.findIndex(
				(s) => s.Segment._id === candidateInstance.segmentId
			)

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

/**
 * Get the ids of parts, segments and rundowns before a given part in the playlist.
 * Note: this will return no segments and rundowns if the part is in the scratchpad
 */
function getIdsBeforeThisPart(context: JobContext, playoutModel: PlayoutModel, nextPart: ReadonlyDeep<DBPart>) {
	const span = context.startSpan('getIdsBeforeThisPart')

	const currentRundown = playoutModel.getRundown(nextPart.rundownId)
	const currentSegment = currentRundown?.getSegment(nextPart.segmentId)

	// Get the normal parts
	const partsBeforeThisInSegment = currentSegment?.Parts?.filter((p) => p._rank < nextPart._rank) ?? []

	// Find any orphaned parts
	const partInstancesBeforeThisInSegment = playoutModel.LoadedPartInstances.filter(
		(p) =>
			p.PartInstance.segmentId === nextPart.segmentId &&
			!!p.PartInstance.orphaned &&
			p.PartInstance.part._rank < nextPart._rank
	)
	partsBeforeThisInSegment.push(...partInstancesBeforeThisInSegment.map((p) => p.PartInstance.part))

	const partsBeforeThisInSegmentSorted = _.sortBy(partsBeforeThisInSegment, (p) => p._rank).map((p) => p._id)

	const nextPartSegment = currentRundown?.getSegment(nextPart.segmentId)
	if (nextPartSegment?.Segment?.orphaned === SegmentOrphanedReason.SCRATCHPAD) {
		if (span) span.end()
		return {
			partsToReceiveOnSegmentEndFrom: partsBeforeThisInSegmentSorted,
			segmentsToReceiveOnRundownEndFrom: [],
			rundownsToReceiveOnShowStyleEndFrom: [],
		}
	} else {
		// Note: In theory we should ignore any scratchpad segments here, but they will never produce any planned `Pieces`, only `PieceInstances`

		const currentSegment = currentRundown?.getSegment(nextPart.segmentId)
		const segmentsToReceiveOnRundownEndFrom =
			currentRundown && currentSegment
				? currentRundown.Segments.filter(
						(s) =>
							s.Segment.rundownId === nextPart.rundownId &&
							s.Segment._rank < currentSegment.Segment._rank &&
							s.Segment.orphaned !== SegmentOrphanedReason.SCRATCHPAD
				  ).map((p) => p.Segment._id)
				: []

		const sortedRundownIds = sortRundownIDsInPlaylist(
			playoutModel.Playlist.rundownIdsInOrder,
			playoutModel.Rundowns.map((rd) => rd.Rundown._id)
		)
		const currentRundownIndex = sortedRundownIds.indexOf(nextPart.rundownId)
		const rundownsToReceiveOnShowStyleEndFrom =
			currentRundownIndex === -1 ? [] : sortedRundownIds.slice(0, currentRundownIndex)

		if (span) span.end()
		return {
			partsToReceiveOnSegmentEndFrom: partsBeforeThisInSegmentSorted,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom,
		}
	}
}

/**
 * Find all infinite Pieces that _may_ be active in the given Part, which will be continued from a previous part
 * Either search a provided ingest cache, or the database for these Pieces
 * @param context Context of the current job
 * @param playoutModel Playout cache for the current playlist
 * @param unsavedIngestCache If an ingest cache is loaded, we can search that instead of mongo
 * @param part The Part to get the Pieces for
 * @returns Array of Piece
 */
export async function fetchPiecesThatMayBeActiveForPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	unsavedIngestCache: Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'> | undefined,
	part: ReadonlyDeep<DBPart>
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
	const { partsToReceiveOnSegmentEndFrom, segmentsToReceiveOnRundownEndFrom, rundownsToReceiveOnShowStyleEndFrom } =
		getIdsBeforeThisPart(context, playoutModel, part)

	if (unsavedIngestCache?.RundownId === part.rundownId) {
		// Find pieces for the current rundown
		const thisRundownPieceQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
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
			rundownsToReceiveOnShowStyleEndFrom
		)
		if (previousRundownPieceQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(previousRundownPieceQuery))
		}
	} else {
		// No cache, so we can do a single query to the db for it all
		const infinitePiecesQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom
		)
		if (infinitePiecesQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(infinitePiecesQuery))
		}
	}

	const pieces = flatten(await Promise.all(piecePromises))
	if (span) span.end()
	return pieces
}

/**
 * Update the onChange infinites for the nextPartInstance to be up to date with the ones on the currentPartInstance
 * @param context Context for the current job
 * @param playoutModel Playout cache for the current playlist
 */
export async function syncPlayheadInfinitesForNextPartInstance(
	context: JobContext,
	playoutModel: PlayoutModel,
	fromPartInstance: PlayoutPartInstanceModel | null,
	toPartInstance: PlayoutPartInstanceModel | null
): Promise<void> {
	const span = context.startSpan('syncPlayheadInfinitesForNextPartInstance')

	if (toPartInstance && fromPartInstance) {
		const playlist = playoutModel.Playlist
		if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

		const {
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom,
		} = getIdsBeforeThisPart(context, playoutModel, toPartInstance.PartInstance.part)

		const currentRundown = playoutModel.getRundown(fromPartInstance.PartInstance.rundownId)
		if (!currentRundown) throw new Error(`Rundown "${fromPartInstance.PartInstance.rundownId}" not found!`)

		const currentSegment = currentRundown.getSegment(fromPartInstance.PartInstance.segmentId)
		if (!currentSegment) throw new Error(`Segment "${fromPartInstance.PartInstance.segmentId}" not found!`)

		const nextRundown = playoutModel.getRundown(toPartInstance.PartInstance.rundownId)
		if (!nextRundown) throw new Error(`Rundown "${toPartInstance.PartInstance.rundownId}" not found!`)

		const nextSegment = nextRundown.getSegment(toPartInstance.PartInstance.segmentId)
		if (!nextSegment) throw new Error(`Segment "${toPartInstance.PartInstance.segmentId}" not found!`)

		const showStyleBase = await context.getShowStyleBase(nextRundown.Rundown.showStyleBaseId)

		const nextPartIsAfterCurrentPart = candidatePartIsAfterPreviewPartInstance(
			context,
			playoutModel.getAllOrderedSegments(),
			fromPartInstance.PartInstance,
			toPartInstance.PartInstance.part
		)

		const nowInPart = getCurrentTime() - (fromPartInstance.PartInstance.timings?.plannedStartedPlayback ?? 0)
		const prunedPieceInstances = processAndPrunePieceInstanceTimings(
			showStyleBase.sourceLayers,
			fromPartInstance.PieceInstances.map((p) => p.PieceInstance),
			nowInPart,
			undefined,
			true
		)

		const rundownIdsToShowstyleIds = getShowStyleIdsRundownMapping(playoutModel.Rundowns)

		const infinites = libgetPlayheadTrackingInfinitesForPart(
			playlist.activationId,
			new Set(partsToReceiveOnSegmentEndFrom),
			new Set(segmentsToReceiveOnRundownEndFrom),
			rundownsToReceiveOnShowStyleEndFrom,
			rundownIdsToShowstyleIds,
			fromPartInstance.PartInstance,
			currentSegment?.Segment,
			prunedPieceInstances,
			nextRundown.Rundown,
			toPartInstance.PartInstance.part,
			nextSegment?.Segment,
			toPartInstance.PartInstance._id,
			nextPartIsAfterCurrentPart,
			false
		)

		toPartInstance.replaceInfinitesFromPreviousPlayhead(infinites)
	}
	if (span) span.end()
}

/**
 * Calculate all of the onEnd PieceInstances for a PartInstance
 * @param context Context for the running job
 * @param playoutModel Playout cache for the current playlist
 * @param playingPartInstance The current PartInstance, if there is one
 * @param rundown The Rundown the Part belongs to
 * @param part The Part the PartInstance is based on
 * @param possiblePieces Array of Pieces that should be considered for being a PieceInstance in the new PartInstance
 * @param newInstanceId Id of the PartInstance
 * @returns Array of PieceInstances for the specified PartInstance
 */
export function getPieceInstancesForPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	playingPartInstance: PlayoutPartInstanceModel | null,
	rundown: PlayoutRundownModel,
	part: ReadonlyDeep<DBPart>,
	possiblePieces: Piece[],
	newInstanceId: PartInstanceId
): PieceInstance[] {
	const span = context.startSpan('getPieceInstancesForPart')
	const { partsToReceiveOnSegmentEndFrom, segmentsToReceiveOnRundownEndFrom, rundownsToReceiveOnShowStyleEndFrom } =
		getIdsBeforeThisPart(context, playoutModel, part)

	const playlist = playoutModel.Playlist
	if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

	const playingPieceInstances = playingPartInstance?.PieceInstances ?? []

	const nextPartIsAfterCurrentPart = candidatePartIsAfterPreviewPartInstance(
		context,
		playoutModel.getAllOrderedSegments(),
		playingPartInstance?.PartInstance,
		part
	)

	const rundownIdsToShowstyleIds = getShowStyleIdsRundownMapping(playoutModel.Rundowns)

	let playingRundown: PlayoutRundownModel | undefined
	let playingSegment: PlayoutSegmentModel | undefined
	if (playingPartInstance) {
		playingRundown = playoutModel.getRundown(playingPartInstance.PartInstance.rundownId)
		if (!playingRundown) throw new Error(`Rundown "${playingPartInstance.PartInstance.rundownId}" not found!`)

		playingSegment = playingRundown.getSegment(playingPartInstance.PartInstance.segmentId)
		if (!playingSegment) throw new Error(`Segment "${playingPartInstance.PartInstance.segmentId}" not found!`)
	}

	const segment = rundown.getSegment(part.segmentId)
	if (!segment) throw new Error(`Segment "${part.segmentId}" not found!`)

	const res = libgetPieceInstancesForPart(
		playlist.activationId,
		playingPartInstance?.PartInstance,
		playingSegment?.Segment,
		playingPieceInstances.map((p) => p.PieceInstance),
		rundown.Rundown,
		segment.Segment,
		part,
		new Set(partsToReceiveOnSegmentEndFrom),
		new Set(segmentsToReceiveOnRundownEndFrom),
		rundownsToReceiveOnShowStyleEndFrom,
		rundownIdsToShowstyleIds,
		possiblePieces,
		playoutModel.getAllOrderedParts().map((p) => p._id),
		newInstanceId,
		nextPartIsAfterCurrentPart,
		false
	)
	if (span) span.end()
	return res
}
