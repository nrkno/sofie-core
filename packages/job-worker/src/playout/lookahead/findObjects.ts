import { IBlueprintPieceType, TimelineObjectCoreExt, TSR } from '@sofie-automation/blueprints-integration'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	OnGenerateTimelineObjExt,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../../jobs'
import { PartAndPieces, PieceInstanceWithObjectMap } from './util'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ReadonlyDeep, SetRequired } from 'type-fest'

function getBestPieceInstanceId(piece: ReadonlyDeep<PieceInstance>): string {
	if (!piece.isTemporary || piece.partInstanceId) {
		return unprotectString(piece._id)
	}
	// Something is needed, and it must be distant future here, so accuracy is not important
	return unprotectString(piece.piece.startPartId ?? piece.rundownId)
}

function tryActivateKeyframesForObject(
	obj: TimelineObjectCoreExt<TSR.TSRTimelineContent>,
	hasTransition: boolean,
	classesFromPreviousPart: readonly string[] | undefined
): TSR.TSRTimelineContent {
	// Try and find a keyframe that is used when in a transition
	if (hasTransition) {
		let transitionKF: TSR.Timeline.TimelineKeyframe | undefined
		if (obj.keyframes) {
			transitionKF = obj.keyframes.find((kf) => !Array.isArray(kf.enable) && kf.enable.while === '.is_transition')

			// TODO - this keyframe matching is a hack, and is very fragile

			if (!transitionKF && classesFromPreviousPart && classesFromPreviousPart.length > 0) {
				// Check if the keyframe also uses a class to match. This handles a specific edge case
				transitionKF = obj.keyframes.find((kf) =>
					classesFromPreviousPart.find(
						(cl) => !Array.isArray(kf.enable) && kf.enable.while === `.is_transition & .${cl}`
					)
				)
			}
		}

		return { ...obj.content, ...transitionKF?.content }
	} else {
		return obj.content
	}
}

function getObjectMapForPiece(piece: PieceInstanceWithObjectMap): NonNullable<PieceInstanceWithObjectMap['objectMap']> {
	if (!piece.objectMap) {
		piece.objectMap = new Map()

		const objects = deserializePieceTimelineObjectsBlob(piece.piece.timelineObjectsString)
		for (const obj of objects) {
			// Note: This is assuming that there is only one use of a layer in each piece.
			if (typeof obj.layer === 'string' && !piece.objectMap.has(obj.layer)) {
				piece.objectMap.set(obj.layer, obj)
			}
		}
	}
	return piece.objectMap
}

export type LookaheadTimelineObject = TimelineObjRundown &
	SetRequired<OnGenerateTimelineObjExt, 'pieceInstanceId' | 'partInstanceId'>

function shouldIgnorePiece(partInfo: PartAndPieces, piece: PieceInstanceWithObjectMap): boolean {
	switch (piece.piece.pieceType) {
		case IBlueprintPieceType.InTransition:
			// Ignore if the part will not use the transition
			return !partInfo.usesInTransition
		case IBlueprintPieceType.OutTransition:
			// Always ignore for now
			return true
		case IBlueprintPieceType.Normal:
			// Always allow
			return false
		default:
			assertNever(piece.piece.pieceType)
			return false
	}
}

export function findLookaheadObjectsForPart(
	_context: JobContext,
	currentPartInstanceId: PartInstanceId | null,
	layer: string,
	previousPart: ReadonlyDeep<DBPart> | undefined,
	partInfo: PartAndPieces,
	partInstanceId: PartInstanceId | null
): Array<LookaheadTimelineObject> {
	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}

	const allObjs: Array<LookaheadTimelineObject> = []
	for (const rawPiece of partInfo.pieces) {
		if (shouldIgnorePiece(partInfo, rawPiece)) continue

		const obj = getObjectMapForPiece(rawPiece).get(layer)
		if (obj) {
			allObjs.push(
				literal<LookaheadTimelineObject>({
					metaData: undefined,
					...obj,
					objectType: TimelineObjType.RUNDOWN,
					pieceInstanceId: getBestPieceInstanceId(rawPiece),
					infinitePieceInstanceId: rawPiece.infinite?.infiniteInstanceId,
					partInstanceId: partInstanceId ?? protectString(unprotectString(partInfo.part._id)),
				})
			)
		}
	}

	if (allObjs.length === 0) {
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	}

	let classesFromPreviousPart: readonly string[] = []
	if (previousPart && currentPartInstanceId && partInstanceId) {
		classesFromPreviousPart = previousPart.classesForNext || []
	}

	const transitionPiece = partInfo.usesInTransition
		? partInfo.pieces.find((i) => i.piece.pieceType === IBlueprintPieceType.InTransition)
		: undefined

	if (allObjs.length === 1) {
		// Only one, just return it
		const obj = allObjs[0]
		const patchedContent = tryActivateKeyframesForObject(obj, !!transitionPiece, classesFromPreviousPart)

		return [
			{
				...obj,
				content: patchedContent,
			},
		]
	} else {
		const hasTransitionObj = transitionPiece && getObjectMapForPiece(transitionPiece).get(layer)

		const res: Array<LookaheadTimelineObject> = []
		partInfo.pieces.forEach((piece) => {
			if (shouldIgnorePiece(partInfo, piece)) return

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransitionObj &&
				piece.piece.pieceType === IBlueprintPieceType.Normal &&
				piece.piece.enable.start === 0
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = getObjectMapForPiece(piece).get(layer)
			if (obj) {
				const patchedContent = tryActivateKeyframesForObject(obj, !!transitionPiece, classesFromPreviousPart)

				res.push(
					literal<LookaheadTimelineObject>({
						metaData: undefined,
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

		return res
	}
}
