import { IBlueprintPartOutTransition, IBlueprintPieceType, TSR } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	TimelineObjGroupPart,
	OnGenerateTimelineObjExt,
	TimelineObjType,
	TimelineContentTypeOther,
	TimelineObjRundown,
	TimelineObjPartAbstract,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { getPartGroupId, getPartFirstObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/infinites'
import { PieceTimelineMetadata } from '@sofie-automation/corelib/dist/playout/pieces'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { JobContext } from '../../jobs'
import { ReadonlyDeep } from 'type-fest'
import { getPieceEnableInsidePart, transformPieceGroupAndObjects } from './piece'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export function transformPartIntoTimeline(
	context: JobContext,
	playlistId: RundownPlaylistId,
	pieceInstances: ReadonlyDeep<Array<PieceInstanceWithTimings>>,
	pieceGroupFirstObjClasses: string[],
	parentGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInParentGroup: number,
	partTimings: PartCalculatedTimings,
	isInHold: boolean,
	outTransition: IBlueprintPartOutTransition | null
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = context.startSpan('transformPartIntoTimeline')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.disabled) continue

		let pieceEnable: TSR.Timeline.TimelineEnable | undefined
		switch (pieceInstance.piece.pieceType) {
			case IBlueprintPieceType.InTransition:
				if (typeof partTimings.inTransitionStart === 'number') {
					// Respect the start time of the piece, in case there is a reason for it being non-zero
					const startOffset =
						typeof pieceInstance.piece.enable.start === 'number' ? pieceInstance.piece.enable.start : 0

					pieceEnable = {
						start: partTimings.inTransitionStart + startOffset,
						duration: pieceInstance.piece.enable.duration,
					}
				}
				break
			case IBlueprintPieceType.OutTransition:
				if (outTransition) {
					pieceEnable = {
						start: `#${parentGroup.id}.end - ${outTransition.duration}`,
					}
					if (partTimings.toPartPostroll) {
						pieceEnable.start += ' - ' + partTimings.toPartPostroll
					}
				}
				break
			case IBlueprintPieceType.Normal:
				pieceEnable = getPieceEnableInsidePart(pieceInstance, partTimings, parentGroup.id)
				break
			default:
				assertNever(pieceInstance.piece.pieceType)
				break
		}

		// Not able to enable this piece
		if (!pieceEnable) continue

		timelineObjs.push(
			...transformPieceGroupAndObjects(
				playlistId,
				parentGroup,
				nowInParentGroup,
				pieceInstance,
				pieceEnable,
				0,
				pieceGroupFirstObjClasses,
				isInHold,
				false
			)
		)
	}
	if (span) span.end()
	return timelineObjs
}

export interface PartEnable {
	start: number | 'now' | string
	duration?: number
	end?: string
}

export function createPartGroup(
	partInstance: DBPartInstance,
	enable: PartEnable
): TimelineObjGroupPart & OnGenerateTimelineObjExt {
	const partGrp = literal<TimelineObjGroupPart & OnGenerateTimelineObjExt>({
		id: getPartGroupId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: enable,
		priority: 5,
		layer: '', // These should coexist
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		isGroup: true,
		partInstanceId: partInstance._id,
		metaData: literal<PieceTimelineMetadata>({
			isPieceTimeline: true,
		}),
	})

	return partGrp
}

export function createPartGroupFirstObject(
	playlistId: RundownPlaylistId,
	partInstance: DBPartInstance,
	partGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	previousPart?: DBPartInstance
): TimelineObjPartAbstract & OnGenerateTimelineObjExt {
	return literal<TimelineObjPartAbstract & OnGenerateTimelineObjExt>({
		id: getPartFirstObjectId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: 'group_first_object',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			// Will cause the playout-gateway to run a callback, when the object starts playing:
			callBack: PlayoutChangedType.PART_PLAYBACK_STARTED,
			callBackData: {
				rundownPlaylistId: playlistId,
				partInstanceId: partInstance._id,
			},
			callBackStopped: PlayoutChangedType.PART_PLAYBACK_STOPPED, // Will cause a callback to be called, when the object stops playing:
		},
		inGroup: partGroup.id,
		partInstanceId: partGroup.partInstanceId,
		classes: (partInstance.part.classes || []).concat(previousPart ? previousPart.part.classesForNext || [] : []),
		metaData: undefined,
	})
}
