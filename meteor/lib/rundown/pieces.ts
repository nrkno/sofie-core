import { DeepReadonly } from 'utility-types'
import { PieceInstanceWithTimings } from './infinites'
import {
	TimelineObjRundown,
	TimelineObjGroup,
	TimelineContentTypeOther,
	TimelineObjType,
	TimelineObjGroupRundown,
} from '../collections/Timeline'
import { TSR, OnGenerateTimelineObj, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { literal, unprotectString, protectString } from '../lib'
import { clone } from 'underscore'

export function createPieceGroupAndCap(
	pieceInstance: Pick<
		DeepReadonly<PieceInstanceWithTimings>,
		'_id' | 'rundownId' | 'piece' | 'infinite' | 'resolvedEndCap' | 'priority'
	>,
	partGroup?: TimelineObjRundown,
	pieceEnable?: TSR.Timeline.TimelineEnable
): {
	pieceGroup: TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj
	capObjs: TimelineObjRundown[]
} {
	const pieceGroup = literal<TimelineObjGroup & TimelineObjRundown & OnGenerateTimelineObj>({
		id: getPieceGroupId(unprotectString(pieceInstance.piece._id)),
		_id: protectString(''), // set later
		studioId: protectString(''), // set later
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceId: unprotectString(pieceInstance.infinite?.infinitePieceId),
		objectType: TimelineObjType.RUNDOWN,
		enable: clone<TimelineObjRundown['enable']>(pieceEnable ?? pieceInstance.piece.enable),
		layer: pieceInstance.piece.sourceLayerId,
		priority: pieceInstance.priority,
		metaData: {
			pieceId: pieceInstance._id,
		},
	})

	const capObjs: TimelineObjRundown[] = []

	let nowObj: TimelineObjRundown | undefined
	if (pieceInstance.resolvedEndCap === 'now') {
		// TODO-INFINITE - there could already be a piece with a cap of 'now' that we could use as our end time
		// As the cap is for 'now', rather than try to get tsr to understand `end: 'now'`, we can create a 'now' object to tranlate it
		nowObj = literal<TimelineObjRundown>({
			_id: protectString(''), // set later
			studioId: protectString(''), // set later
			objectType: TimelineObjType.RUNDOWN,
			id: `${pieceGroup.id}_cap_now`,
			enable: {
				start: 'now',
			},
			layer: '',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
		})
		capObjs.push(nowObj)
	}

	if (pieceGroup.enable.duration !== undefined) {
		// TODO-INFINITES some cases here could be flattened out if there are no 'now' in use
		if (pieceInstance.resolvedEndCap !== undefined) {
			const pieceGroupId = getPieceGroupId(unprotectString(pieceInstance.piece._id))

			const pieceEndCapGroup = literal<TimelineObjGroupRundown>({
				_id: protectString(''), // set later
				studioId: protectString(''), // set later
				objectType: TimelineObjType.RUNDOWN,
				id: `${pieceGroupId}_cap`,
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
			})
			capObjs.push(pieceEndCapGroup)
			pieceGroup.inGroup = pieceEndCapGroup.id
		}
	} else {
		pieceGroup.enable.end = nowObj ? `#${nowObj.id}.start` : pieceInstance.resolvedEndCap
	}

	return { pieceGroup, capObjs }
}
