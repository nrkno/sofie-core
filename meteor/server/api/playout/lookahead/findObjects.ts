import * as _ from 'underscore'
import { Timeline as TimelineTypes, TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { OnGenerateTimelineObjExt, TimelineObjRundown, TimelineObjType } from '../../../../lib/collections/Timeline'
import { Part } from '../../../../lib/collections/Parts'
import { Piece } from '../../../../lib/collections/Pieces'
import { literal, protectString, unprotectString } from '../../../../lib/lib'
import { PieceInstance, rewrapPieceToInstance } from '../../../../lib/collections/PieceInstances'
import { PartInstanceId } from '../../../../lib/collections/PartInstances'
import { sortPieceInstancesByStart } from '../pieces'
import { profiler } from '../../profiler'
import { isPieceInstance, PartAndPieces } from './util'

function getBestPieceInstanceId(piece: PieceInstance): string {
	if (!piece.isTemporary || piece.partInstanceId) {
		return unprotectString(piece._id)
	}
	// Something is needed, and it must be distant future here, so accuracy is not important
	return unprotectString(piece.piece.startPartId)
}

function tryActivateKeyframesForObject(
	obj: TimelineObjectCoreExt,
	hasTransition: boolean,
	classesFromPreviousPart: string[] | undefined
): TimelineObjectCoreExt['content'] {
	// Try and find a keyframe that is used when in a transition
	if (hasTransition) {
		let transitionKF: TimelineTypes.TimelineKeyframe | undefined = _.find(
			obj.keyframes || [],
			(kf) => !Array.isArray(kf.enable) && kf.enable.while === '.is_transition'
		)

		// TODO - this keyframe matching is a hack, and is very fragile

		if (!transitionKF && classesFromPreviousPart && classesFromPreviousPart.length > 0) {
			// Check if the keyframe also uses a class to match. This handles a specific edge case
			transitionKF = _.find(obj.keyframes || [], (kf) =>
				_.any(
					classesFromPreviousPart,
					(cl) => !Array.isArray(kf.enable) && kf.enable.while === `.is_transition & .${cl}`
				)
			)
		}
		return { ...obj.content, ...transitionKF?.content }
	} else {
		return obj.content
	}
}

export function findLookaheadObjectsForPart(
	currentPartInstanceId: PartInstanceId | null,
	layer: string,
	previousPart: Part | undefined,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null,
	nowInPart: number
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}
	const span = profiler.startSpan('findObjectsForPart')

	const allObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	for (const rawPiece of partInfo.pieces) {
		const tmpPieceInstanceId = getBestPieceInstanceId(rawPiece)
		for (const obj of rawPiece.piece.content?.timelineObjects ?? []) {
			if (obj && obj.layer === layer) {
				allObjs.push(
					literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
						...obj,
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: tmpPieceInstanceId,
						infinitePieceInstanceId: rawPiece.infinite?.infiniteInstanceId,
						partInstanceId: partInstanceId ?? protectString(unprotectString(partInfo.part._id)),
					})
				)
			}
		}
	}

	if (allObjs.length === 0) {
		if (span) span.end()
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	}

	let allowTransition = !partInstanceId
	let classesFromPreviousPart: string[] = []
	if (previousPart && currentPartInstanceId && partInstanceId) {
		// If we have a previous and not at the start of the rundown
		allowTransition = !previousPart.disableOutTransition
		classesFromPreviousPart = previousPart.classesForNext || []
	}

	const transitionPiece = allowTransition ? partInfo.pieces.find((i) => !!i.piece.isTransition) : undefined

	if (allObjs.length === 1) {
		// Only one, just return it
		const obj = allObjs[0]
		const patchedContent = tryActivateKeyframesForObject(obj, !!transitionPiece, classesFromPreviousPart)

		if (span) span.end()
		return [
			{
				...obj,
				content: patchedContent,
			},
		]
	} else {
		// They need to be ordered
		const orderedPieces = sortPieceInstancesByStart(partInfo.pieces, nowInPart)

		const hasTransitionObj = !!transitionPiece?.piece?.content?.timelineObjects?.find((o) => o?.layer === layer)

		const res: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
		orderedPieces.forEach((piece) => {
			if (!allowTransition && piece.piece.isTransition) {
				return
			}

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransitionObj &&
				!piece.piece.isTransition &&
				piece.piece.enable.start === 0 // <-- need to discuss this!
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = piece.piece.content?.timelineObjects?.find((o) => o?.layer === layer)
			if (obj) {
				const patchedContent = tryActivateKeyframesForObject(obj, !!transitionPiece, classesFromPreviousPart)

				res.push(
					literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
						...obj,
						objectType: TimelineObjType.RUNDOWN,
						pieceInstanceId: getBestPieceInstanceId(piece),
						infinitePieceInstanceId: piece.infinite?.infiniteInstanceId,
						partInstanceId: partInstanceId ?? protectString(unprotectString(partInfo.part._id)),
						content: patchedContent,
					})
				)
			}
		})

		if (span) span.end()
		return res
	}
}
