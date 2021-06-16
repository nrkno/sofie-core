import { PartInstanceId } from '../../../../lib/collections/PartInstances'
import { Part, PartId } from '../../../../lib/collections/Parts'
import { wrapPieceToInstance } from '../../../../lib/collections/PieceInstances'
import { Piece } from '../../../../lib/collections/Pieces'
import { OnGenerateTimelineObjExt, TimelineObjRundown } from '../../../../lib/collections/Timeline'
import { protectString } from '../../../../lib/lib'
import { profiler } from '../../profiler'
import { findLookaheadObjectsForPart } from './findObjects'
import { PartAndPieces, PartInstanceAndPieceInstances } from './util'

export interface LookaheadResult {
	timed: Array<TimelineObjRundown & OnGenerateTimelineObjExt>
	future: Array<TimelineObjRundown & OnGenerateTimelineObjExt>
}

export function findLookaheadForLayer(
	currentPartInstanceId: PartInstanceId | null,
	partInstancesInfo: PartInstanceAndPieceInstances[],
	previousPartInstanceInfo: PartInstanceAndPieceInstances | undefined,
	orderedPartsFollowingPlayhead: Part[],
	piecesByPart: Map<PartId, Piece[]>,
	layer: string,
	lookaheadTargetFutureObjects: number,
	lookaheadMaxSearchDistance: number
): LookaheadResult {
	const span = profiler.startSpan(`findLookaheadForlayer.${layer}`)
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartAndPieces | undefined
	if (previousPartInstanceInfo) {
		previousPartInfo = {
			part: previousPartInstanceInfo.part.part,
			pieces: previousPartInstanceInfo.allPieces,
		}
	}

	// Generate timed/future objects for the partInstances
	for (const partInstanceInfo of partInstancesInfo) {
		if (!partInstanceInfo.onTimeline && lookaheadMaxSearchDistance <= 0) break

		const partInfo: PartAndPieces = {
			part: partInstanceInfo.part.part,
			pieces: partInstanceInfo.allPieces,
		}

		const objs = findLookaheadObjectsForPart(
			currentPartInstanceId,
			layer,
			previousPartInfo?.part,
			partInfo,
			partInstanceInfo.part._id,
			partInstanceInfo.nowInPart
		)

		if (partInstanceInfo.onTimeline) {
			res.timed.push(...objs)
		} else {
			res.future.push(...objs)
		}

		previousPartInfo = partInfo
	}

	if (lookaheadMaxSearchDistance > 1 && lookaheadTargetFutureObjects > 0) {
		for (const part of orderedPartsFollowingPlayhead.slice(0, lookaheadMaxSearchDistance - 1)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetFutureObjects) {
				break
			}
			const pieces = piecesByPart.get(part._id) ?? []
			if (pieces.length > 0 && part.isPlayable()) {
				const tmpPieces = pieces.map((p) => wrapPieceToInstance(p, protectString(''), protectString(''), true))
				const partInfo: PartAndPieces = { part, pieces: tmpPieces }
				const objs = findLookaheadObjectsForPart(
					currentPartInstanceId,
					layer,
					previousPartInfo?.part,
					partInfo,
					null,
					0
				)
				res.future.push(...objs)
				previousPartInfo = partInfo
			}
		}
	}

	if (span) span.end()
	return res
}
