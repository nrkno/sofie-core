import { PartInstance } from '../../../../lib/collections/PartInstances'
import { Part } from '../../../../lib/collections/Parts'
import { PieceInstance, PieceInstancePiece } from '../../../../lib/collections/PieceInstances'
import { Piece } from '../../../../lib/collections/Pieces'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { CacheForRundownPlaylist } from '../../../cache/DatabaseCaches'
import { profiler } from '../../profiler'
import { getAllOrderedPartsFromCache, getSelectedPartInstancesFromCache, selectNextPart } from '../lib'

export interface PartInstanceAndPieceInstances {
	part: PartInstance
	onTimeline: boolean
	nowInPart: number
	allPieces: PieceInstance[]
}
export interface PartAndPieces {
	part: Part
	pieces: PieceInstance[]
}

export function isPieceInstance(piece: Piece | PieceInstance | PieceInstancePiece): piece is PieceInstance {
	const tmpPiece = piece as PieceInstance
	return typeof tmpPiece.piece !== 'undefined'
}

/**
 * Excludes the previous, current and next part
 */
export function getOrderedPartsAfterPlayhead(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	partCount: number
): Part[] {
	if (partCount <= 0) {
		return []
	}
	const span = profiler.startSpan('getOrderedPartsAfterPlayhead')

	const orderedParts = getAllOrderedPartsFromCache(cache, playlist)
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)

	// If the nextPartInstance consumes the
	const alreadyConsumedNextSegmentId =
		nextPartInstance && (!currentPartInstance || currentPartInstance.segmentId !== nextPartInstance.segmentId)

	const strippedPlaylist = {
		nextSegmentId: alreadyConsumedNextSegmentId ? undefined : playlist.nextSegmentId,
		loop: playlist.loop,
	}
	const nextNextPart = selectNextPart(strippedPlaylist, nextPartInstance ?? currentPartInstance ?? null, orderedParts)
	if (!nextNextPart) {
		// We don't know where to begin searching, so we can't do anything
		return []
	}

	const playablePartsSlice = orderedParts.slice(nextNextPart.index).filter((p) => p.isPlayable())

	const res: Part[] = []

	const nextSegmentIndex = playablePartsSlice.findIndex((p) => p.segmentId === playlist.nextSegmentId)
	if (
		playlist.nextSegmentId &&
		!alreadyConsumedNextSegmentId &&
		nextSegmentIndex !== -1 &&
		!nextNextPart.consumesNextSegmentId
	) {
		// TODO - this if clause needs some decent testing

		// Push the next part and the remainder of its segment
		res.push(...playablePartsSlice.filter((p) => p.segmentId === nextNextPart.part.segmentId))

		// Push from nextSegmentId to the end of the playlist
		res.push(...playablePartsSlice.slice(nextSegmentIndex))
	} else {
		// Push as many parts as we want
		res.push(...playablePartsSlice)
	}

	if (res.length < partCount && playlist.loop) {
		// The rundown would loop here, so lets run with that
		const playableParts = orderedParts.filter((p) => p.isPlayable())
		// Note: We only add it once, as lookahead is unlikely to show anything new in a second pass
		res.push(...playableParts)

		if (span) span.end()
		// Final trim to ensure it is within bounds
		return res.slice(0, partCount)
	} else {
		if (span) span.end()
		// We reached the target or ran out of parts
		return res.slice(0, partCount)
	}
}
