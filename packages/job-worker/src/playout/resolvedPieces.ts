import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { CacheForPlayout } from './cache'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../jobs'
import { getCurrentTime } from '../lib'
import {
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstances,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { ReadOnlyCache } from '../cache/CacheBase'
import { SelectedPartInstancesTimelineInfo } from './timeline/generate'

/**
 * Resolve the PieceInstances for a PartInstance
 * Uses the getCurrentTime() as approximation for 'now'
 * @param context Context for current job
 * @param cache Cache for the active Playlist
 * @param sourceLayers SourceLayers for the current ShowStyle
 * @param partInstance PartInstance to resolve
 * @returns ResolvedPieceInstances sorted by startTime
 */
export function getResolvedPiecesForCurrentPartInstance(
	_context: JobContext,
	cache: ReadOnlyCache<CacheForPlayout>,
	sourceLayers: SourceLayers,
	partInstance: Pick<DBPartInstance, '_id' | 'timings'>,
	now?: number
): ResolvedPieceInstance[] {
	const pieceInstances = cache.PieceInstances.findAll((p) => p.partInstanceId === partInstance._id)

	if (now === undefined) now = getCurrentTime()

	const partStarted = partInstance.timings?.plannedStartedPlayback
	const nowInPart = partStarted ? now - partStarted : 0

	const preprocessedPieces = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, nowInPart)
	return resolvePrunedPieceInstances(nowInPart, preprocessedPieces)
}

export function getResolvedPiecesForPartInstancesOnTimeline(
	_context: JobContext,
	partInstancesInfo: SelectedPartInstancesTimelineInfo,
	now: number
): ResolvedPieceInstance[] {
	// With no current part, there are no timings to consider
	if (!partInstancesInfo.current) return []

	const currentPartStarted = partInstancesInfo.current.partStarted ?? now
	const nextPartStarted =
		partInstancesInfo.current.partInstance.part.expectedDuration !== undefined
			? currentPartStarted + partInstancesInfo.current.partInstance.part.expectedDuration
			: null

	// Calculate the next part if needed
	let nextResolvedPieces: ResolvedPieceInstance[] = []
	if (partInstancesInfo.next && partInstancesInfo.current.partInstance.part.autoNext && nextPartStarted != null) {
		nextResolvedPieces = resolvePrunedPieceInstances(
			partInstancesInfo.next.nowInPart,
			partInstancesInfo.next.pieceInstances
		)

		// Translate start to absolute times
		offsetResolvedStartAndCapDuration(nextResolvedPieces, nextPartStarted, null)
	}

	// Calculate the current part
	const currentResolvedPieces = resolvePrunedPieceInstances(
		partInstancesInfo.current.nowInPart,
		partInstancesInfo.current.pieceInstances
	)

	// Translate start to absolute times
	offsetResolvedStartAndCapDuration(currentResolvedPieces, currentPartStarted, nextPartStarted)

	// Calculate the previous part
	let previousResolvedPieces: ResolvedPieceInstance[] = []
	if (partInstancesInfo.previous?.partStarted) {
		previousResolvedPieces = resolvePrunedPieceInstances(
			partInstancesInfo.previous.nowInPart,
			partInstancesInfo.previous.pieceInstances
		)

		// Translate start to absolute times
		offsetResolvedStartAndCapDuration(
			previousResolvedPieces,
			partInstancesInfo.previous.partStarted,
			currentPartStarted
		)
	}

	const currentInfinitePieces = new Map<PieceInstanceInfiniteId, ResolvedPieceInstance>()
	for (const piece of currentResolvedPieces) {
		if (piece.infinite) {
			currentInfinitePieces.set(piece.infinite.infiniteInstanceId, piece)
		}
	}

	const resultingPieces: ResolvedPieceInstance[] = [...currentResolvedPieces]

	// Merge any infinite chains between the previous and current parts
	for (const piece of previousResolvedPieces) {
		if (piece.infinite) {
			const continuingInfinite = currentInfinitePieces.get(piece.infinite.infiniteInstanceId)
			if (continuingInfinite) {
				// Extend the duration to compensate for the moved start
				if (continuingInfinite.resolvedDuration !== undefined) {
					continuingInfinite.resolvedDuration += continuingInfinite.resolvedStart - piece.resolvedStart
				}

				// Move the start time to be for the previous Piece
				continuingInfinite.resolvedStart = piece.resolvedStart

				continue
			}
		}

		resultingPieces.push(piece)
	}

	// Merge any infinite chains between the current and next parts
	for (const piece of nextResolvedPieces) {
		if (piece.infinite) {
			const continuingInfinite = currentInfinitePieces.get(piece.infinite.infiniteInstanceId)
			if (continuingInfinite) {
				// Update the duration to be based upon the copy from the next part
				if (piece.resolvedDuration !== undefined) {
					continuingInfinite.resolvedDuration =
						piece.resolvedDuration + piece.resolvedStart - continuingInfinite.resolvedStart
				} else {
					delete continuingInfinite.resolvedDuration
				}

				continue
			}
		}

		resultingPieces.push(piece)
	}

	return resultingPieces
}

function offsetResolvedStartAndCapDuration(
	pieces: ResolvedPieceInstance[],
	partStarted: number,
	endCap: number | null
) {
	for (const piece of pieces) {
		piece.resolvedStart += partStarted

		if (endCap !== null) {
			// Cap it to the end of the Part. If it is supposed to be longer, there will be a continuing infinite
			const partEndCap = endCap - piece.resolvedStart

			piece.resolvedDuration =
				piece.resolvedDuration !== undefined ? Math.min(piece.resolvedDuration, partEndCap) : partEndCap
		}
	}
}
