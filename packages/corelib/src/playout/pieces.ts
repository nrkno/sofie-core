import {
	OnGenerateTimelineObjExt,
	TimelineContentTypeOther,
	TimelineObjGroupRundown,
	TimelineObjRundown,
	TimelineObjType,
} from '../dataModel/Timeline'
import { ReadonlyDeep } from 'type-fest'
import { TSR } from '@sofie-automation/blueprints-integration'
import { PieceInstanceId } from '../dataModel/Ids'
import { clone, literal } from '../lib'
import { getPieceGroupId } from './ids'
import { unprotectString } from '../protectedString'
import { PieceInstanceWithTimings } from './infinites'

export interface PieceTimelineMetadata {
	isPieceTimeline: boolean
}

export interface PieceGroupMetadata extends PieceTimelineMetadata {
	pieceId: PieceInstanceId
}

export function createPieceGroupAndCap(
	pieceInstance: Pick<
		ReadonlyDeep<PieceInstanceWithTimings>,
		'_id' | 'rundownId' | 'piece' | 'infinite' | 'resolvedEndCap' | 'priority' | 'partInstanceId' | 'userDuration'
	>,
	partGroup?: TimelineObjRundown,
	pieceEnable?: TSR.Timeline.TimelineEnable,
	pieceStartOffset?: number
): {
	pieceGroup: TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceGroupMetadata>
	capObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt>
} {
	if (pieceEnable) {
		pieceEnable = clone(pieceEnable)
	} else {
		if (pieceInstance.userDuration) {
			pieceEnable = {
				start: pieceInstance.piece.enable.start,
				end: pieceInstance.userDuration.end,
			}
		} else {
			pieceEnable = clone(pieceInstance.piece.enable)
		}
	}

	const pieceGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceGroupMetadata>>({
		id: getPieceGroupId(pieceInstance),
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceInstance.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: pieceEnable,
		layer: pieceInstance.piece.sourceLayerId,
		priority: pieceInstance.priority,
		metaData: literal<PieceGroupMetadata>({
			pieceId: pieceInstance._id,
			isPieceTimeline: true,
		}),
	})

	const capObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	let resolvedEndCap = pieceInstance.resolvedEndCap
	if (resolvedEndCap === 'now') {
		// TODO - there could already be a piece with a cap of 'now' that we could use as our end time
		// As the cap is for 'now', rather than try to get tsr to understand `end: 'now'`, we can create a 'now' object to tranlate it
		const nowObj = literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
			objectType: TimelineObjType.RUNDOWN,
			id: `${pieceGroup.id}_cap_now`,
			enable: {
				start: 'now',
			},
			layer: '',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			partInstanceId: pieceGroup.partInstanceId,
			metaData: literal<PieceTimelineMetadata>({
				isPieceTimeline: true,
			}),
		})
		capObjs.push(nowObj)
		resolvedEndCap = `#${nowObj.id}.start`
	} else if (pieceStartOffset && resolvedEndCap !== undefined) {
		// If the start has been adjusted, the end needs to be updated to compensate
		if (typeof resolvedEndCap === 'number') {
			resolvedEndCap -= pieceStartOffset
		} else {
			resolvedEndCap = `${resolvedEndCap} - ${pieceStartOffset}`
		}
	}

	if (pieceGroup.enable.duration !== undefined || pieceGroup.enable.end !== undefined) {
		let updatedPieceGroup = false
		if (typeof resolvedEndCap === 'number') {
			// If everything is numeric, we can keep it simple and flatten it out here
			if (typeof pieceGroup.enable.end === 'number') {
				updatedPieceGroup = true
				pieceGroup.enable.end = Math.min(pieceGroup.enable.end, resolvedEndCap)
			} else if (typeof pieceGroup.enable.start === 'number' && typeof pieceGroup.enable.duration === 'number') {
				updatedPieceGroup = true
				pieceGroup.enable.end = Math.min(pieceGroup.enable.start + pieceGroup.enable.duration, resolvedEndCap)
				delete pieceGroup.enable.duration
			}
		}

		if (!updatedPieceGroup && resolvedEndCap !== undefined) {
			// Create a wrapper group to apply the end cap
			const pieceEndCapGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt>({
				objectType: TimelineObjType.RUNDOWN,
				id: `${pieceGroup.id}_cap`,
				enable: {
					start: 0,
					end: resolvedEndCap,
				},
				layer: '',
				children: [],
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
					type: TimelineContentTypeOther.GROUP,
				},
				isGroup: true,
				inGroup: partGroup && partGroup.id,
				partInstanceId: pieceGroup.partInstanceId,
				metaData: literal<PieceTimelineMetadata>({
					isPieceTimeline: true,
				}),
			})
			capObjs.push(pieceEndCapGroup)
			pieceGroup.inGroup = pieceEndCapGroup.id
		}
	} else {
		pieceGroup.enable.end = resolvedEndCap
	}

	return { pieceGroup, capObjs }
}
