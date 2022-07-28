import {
	TSR,
	IBlueprintPiece,
	TimelineObjectCoreExt,
	TimelineObjHoldMode,
} from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	TimelineObjRundown,
	OnGenerateTimelineObjExt,
	TimelineObjPieceAbstract,
	TimelineObjType,
	TimelineObjGroupPart,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { assertNever, clone, literal } from '@sofie-automation/corelib/dist/lib'
import { getPieceFirstObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import { createPieceGroupAndCap } from '@sofie-automation/corelib/dist/playout/pieces'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { prefixAllObjectIds } from '../lib'
import { hasPieceInstanceDefinitelyEnded } from './lib'

export function transformPieceGroupAndObjects(
	playlistId: RundownPlaylistId,
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInPart: number,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	pieceEnable: TSR.Timeline.TimelineEnable,
	pieceStartOffset: number, // If the start of the piece has been offset inside the partgroup
	firstObjClasses: string[],
	isInHold: boolean,
	includeHoldExceptObjects: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	// If a piece has definitely finished playback, then we can prune its contents. But we can only do that check if the part has an absolute time, otherwise we are only guessing
	const hasDefinitelyEnded =
		typeof partGroup.enable.start === 'number' && hasPieceInstanceDefinitelyEnded(pieceInstance, nowInPart)

	// create a piece group for the pieces and then place all of them there
	const { pieceGroup, capObjs } = createPieceGroupAndCap(pieceInstance, partGroup, pieceEnable, pieceStartOffset)
	const timelineObjs = [pieceGroup, ...capObjs]

	if (!pieceInstance.piece.virtual && !hasDefinitelyEnded) {
		timelineObjs.push(createPieceGroupFirstObject(playlistId, pieceInstance, pieceGroup, firstObjClasses))

		const pieceObjects: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

		const objects = deserializePieceTimelineObjectsBlob(pieceInstance.piece.timelineObjectsString)
		for (const o of objects) {
			// Some objects can be filtered out at times based on the holdMode of the object
			switch (o.holdMode) {
				case TimelineObjHoldMode.NORMAL:
				case undefined:
					break
				case TimelineObjHoldMode.EXCEPT:
					if (isInHold && !includeHoldExceptObjects) {
						continue
					}
					break
				case TimelineObjHoldMode.ONLY:
					if (!isInHold) {
						continue
					}
					break
				default:
					assertNever(o.holdMode)
			}

			pieceObjects.push({
				...clone<TimelineObjectCoreExt>(o),
				inGroup: pieceGroup.id,
				objectType: TimelineObjType.RUNDOWN,
				pieceInstanceId: unprotectString(pieceInstance._id),
				infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
				partInstanceId: partGroup.partInstanceId,
			})
		}

		// This `prefixAllObjectIds` call needs to match the one in, lookahead.ts. If changed then getStartOfObjectRef() will need updating
		timelineObjs.push(...prefixAllObjectIds(pieceObjects, unprotectString(pieceInstance._id)))
	}

	return timelineObjs
}

export function createPieceGroupFirstObject(
	playlistId: RundownPlaylistId,
	pieceInstance: ReadonlyDeep<PieceInstance>,
	pieceGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	firstObjClasses?: string[]
): TimelineObjPieceAbstract & OnGenerateTimelineObjExt {
	const firstObject = literal<TimelineObjPieceAbstract & OnGenerateTimelineObjExt>({
		id: getPieceFirstObjectId(pieceInstance),
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceGroup.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: pieceInstance.piece.sourceLayerId + '_firstobject',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			callBack: 'piecePlaybackStarted',
			callBackData: {
				rundownPlaylistId: playlistId,
				pieceInstanceId: pieceInstance._id,
				dynamicallyInserted: pieceInstance.dynamicallyInserted !== undefined,
			},
			callBackStopped: 'piecePlaybackStopped', // Will cause a callback to be called, when the object stops playing:
		},
		classes: firstObjClasses,
		inGroup: pieceGroup.id,
	})
	return firstObject
}

export function getPieceEnableInsidePart(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	partTimings: PartCalculatedTimings
): IBlueprintPiece['enable'] {
	const pieceEnable = { ...pieceInstance.piece.enable }
	if (typeof pieceEnable.start === 'number' && !pieceInstance.adLibSourceId) {
		// timed pieces should be offset based on the preroll of the part
		pieceEnable.start += partTimings.toPartDelay

		if (pieceInstance.piece.prerollDuration) {
			// Offset pre-programmed pieces by their own preroll
			pieceEnable.start -= pieceInstance.piece.prerollDuration

			// Duration needs to be extended to compensate
			if (typeof pieceEnable.duration === 'number') {
				pieceEnable.duration += pieceInstance.piece.prerollDuration
			}
		}
	}
	return pieceEnable
}
