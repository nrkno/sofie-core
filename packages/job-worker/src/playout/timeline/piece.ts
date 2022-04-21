import { TSR, TimelineObjectCoreExt, TimelineObjHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	TimelineObjRundown,
	OnGenerateTimelineObjExt,
	TimelineObjType,
	TimelineObjGroupPart,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { assertNever, clone } from '@sofie-automation/corelib/dist/lib'
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
	controlObjClasses: string[],
	isInHold: boolean,
	includeHoldExceptObjects: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	// If a piece has definitely finished playback, then we can prune its contents. But we can only do that check if the part has an absolute time, otherwise we are only guessing
	const hasDefinitelyEnded =
		typeof partGroup.enable.start === 'number' && hasPieceInstanceDefinitelyEnded(pieceInstance, nowInPart)

	// create a piece group for the pieces and then place all of them there
	const { controlObj, childGroup, capObjs } = createPieceGroupAndCap(
		playlistId,
		pieceInstance,
		controlObjClasses,
		partGroup,
		pieceEnable
	)
	// We need all these objects so that we can resolve all the piece timings in this timeline
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = [controlObj, childGroup, ...capObjs]

	if (!pieceInstance.piece.virtual && !hasDefinitelyEnded) {
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
				metaData: undefined,
				...clone<TimelineObjectCoreExt>(o),
				inGroup: childGroup.id,
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

export function getPieceEnableInsidePart(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	partTimings: PartCalculatedTimings,
	partGroupId: string
): TSR.Timeline.TimelineEnable {
	const pieceEnable: TSR.Timeline.TimelineEnable = { ...pieceInstance.piece.enable }
	if (typeof pieceEnable.start === 'number' && !pieceInstance.dynamicallyInserted) {
		// timed pieces should be offset based on the preroll of the part
		pieceEnable.start += partTimings.toPartDelay
	}
	if (partTimings.toPartPostroll) {
		if (!pieceEnable.duration) {
			// make sure that the control object is shortened correctly
			pieceEnable.duration = `#${partGroupId} - ${partTimings.toPartPostroll}`
		}
	}
	return pieceEnable
}
