import {
	OnGenerateTimelineObjExt,
	TimelineContentTypeOther,
	TimelineObjGroupRundown,
	TimelineObjPieceAbstract,
	TimelineObjRundown,
	TimelineObjType,
} from '../dataModel/Timeline'
import { ReadonlyDeep } from 'type-fest'
import { TSR } from '@sofie-automation/blueprints-integration'
import { PieceInstanceId, RundownPlaylistId } from '../dataModel/Ids'
import { clone, literal } from '../lib'
import { getPieceControlObjectId, getPieceGroupId } from './ids'
import { unprotectString } from '../protectedString'
import { PieceInstanceWithTimings } from './infinites'

export interface PieceTimelineMetadata {
	isPieceTimeline: boolean
}

export interface PieceGroupMetadata extends PieceTimelineMetadata {
	pieceId: PieceInstanceId
}

export function createPieceGroupAndCap(
	playlistId: RundownPlaylistId,
	pieceInstance: Pick<
		ReadonlyDeep<PieceInstanceWithTimings>,
		| '_id'
		| 'rundownId'
		| 'piece'
		| 'infinite'
		| 'resolvedEndCap'
		| 'priority'
		| 'partInstanceId'
		| 'userDuration'
		| 'dynamicallyInserted'
	>,
	controlObjClasses?: string[],
	partGroup?: TimelineObjRundown,
	pieceEnable?: TSR.Timeline.TimelineEnable
): {
	controlObj: TimelineObjPieceAbstract & OnGenerateTimelineObjExt<PieceGroupMetadata>
	childGroup: TimelineObjGroupRundown & OnGenerateTimelineObjExt
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

	const controlObj = literal<TimelineObjPieceAbstract & OnGenerateTimelineObjExt<PieceGroupMetadata>>({
		id: getPieceControlObjectId(pieceInstance),
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceInstance.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: pieceEnable,
		layer: pieceInstance.piece.sourceLayerId,
		priority: pieceInstance.priority,
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
		classes: controlObjClasses,
		inGroup: partGroup && partGroup.id,
		metaData: {
			pieceId: pieceInstance._id,
			isPieceTimeline: true,
		},
	})

	const childGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt>({
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
		enable: {
			// TODO - better rules for this
			start: `#${controlObj.id}.start - ${pieceInstance.piece.prerollDuration ?? 0}`,
			end: `#${controlObj.id}.end - ${/*pieceInstance.piece.postrollDuration??*/ 0}`,
		},
		layer: '',
	})

	const capObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	let nowObj: (TimelineObjRundown & OnGenerateTimelineObjExt) | undefined
	if (pieceInstance.resolvedEndCap === 'now') {
		// TODO - there could already be a piece with a cap of 'now' that we could use as our end time
		// As the cap is for 'now', rather than try to get tsr to understand `end: 'now'`, we can create a 'now' object to tranlate it
		nowObj = literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
			objectType: TimelineObjType.RUNDOWN,
			id: `${controlObj.id}_cap_now`,
			enable: {
				start: 'now',
			},
			layer: '',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			partInstanceId: controlObj.partInstanceId,
			metaData: literal<PieceTimelineMetadata>({
				isPieceTimeline: true,
			}),
		})
		capObjs.push(nowObj)
	}

	if (controlObj.enable.duration !== undefined || controlObj.enable.end !== undefined) {
		let updatedControlObj = false
		if (typeof pieceInstance.resolvedEndCap === 'number') {
			// If everything is numeric, we can keep it simple and flatten it out here
			if (typeof controlObj.enable.end === 'number') {
				updatedControlObj = true
				controlObj.enable.end = Math.min(controlObj.enable.end, pieceInstance.resolvedEndCap)
			} else if (typeof controlObj.enable.start === 'number' && typeof controlObj.enable.duration === 'number') {
				updatedControlObj = true
				controlObj.enable.end = Math.min(
					controlObj.enable.start + controlObj.enable.duration,
					pieceInstance.resolvedEndCap
				)
				delete controlObj.enable.duration
			}
		}

		if (!updatedControlObj && pieceInstance.resolvedEndCap !== undefined) {
			// Create a wrapper group to apply the end cap
			const pieceEndCapGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt>({
				objectType: TimelineObjType.RUNDOWN,
				id: `${controlObj.id}_cap`,
				enable: {
					start: 0,
					end: nowObj ? `#${nowObj.id}.start` : pieceInstance.resolvedEndCap,
				},
				layer: '',
				children: [],
				content: {
					deviceType: TSR.DeviceType.ABSTRACT,
					type: TimelineContentTypeOther.GROUP,
				},
				isGroup: true,
				inGroup: partGroup && partGroup.id,
				partInstanceId: controlObj.partInstanceId,
				metaData: literal<PieceTimelineMetadata>({
					isPieceTimeline: true,
				}),
			})
			capObjs.push(pieceEndCapGroup)
			controlObj.inGroup = pieceEndCapGroup.id
		}
	} else {
		controlObj.enable.end = nowObj ? `#${nowObj.id}.start` : pieceInstance.resolvedEndCap
	}

	return { controlObj, childGroup, capObjs }
}
