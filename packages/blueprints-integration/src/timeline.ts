import { IBlueprintPartInstance, IBlueprintPieceInstance } from './rundown'

import * as TSR from 'timeline-state-resolver-types'
import { CombineArrayType } from './lib'
export { TSR }

export { Timeline } from 'timeline-state-resolver-types'

export enum PlayoutTimelinePrefixes {
	PART_GROUP_PREFIX = 'part_group_',
	PART_GROUP_FIRST_ITEM_PREFIX = 'part_group_firstobject_',
	PIECE_GROUP_PREFIX = 'piece_group_',
	PIECE_GROUP_FIRST_ITEM_PREFIX = 'piece_group_firstobject_',
}

export function getPartGroupId(part: IBlueprintPartInstance | string) {
	if (typeof part === 'string') {
		return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_PREFIX + part._id
}
export function getPieceGroupId(piece: IBlueprintPieceInstance | string) {
	if (typeof piece === 'string') {
		return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_PREFIX + piece._id
}
export function getPartFirstObjectId(part: IBlueprintPartInstance | string) {
	if (typeof part === 'string') {
		return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part
	}
	return PlayoutTimelinePrefixes.PART_GROUP_FIRST_ITEM_PREFIX + part._id
}
export function getPieceFirstObjectId(piece: IBlueprintPieceInstance | string) {
	if (typeof piece === 'string') {
		return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece
	}

	return PlayoutTimelinePrefixes.PIECE_GROUP_FIRST_ITEM_PREFIX + piece._id
}

export enum TimelineObjHoldMode {
	NORMAL = 0,
	ONLY = 1, // Only use when in HOLD
	EXCEPT = 2, // Only use when not in HOLD
}

export interface TimelineObjectCoreExt<TMetadata = unknown, TKeyframeMetadata = unknown>
	extends TSR.TSRTimelineObjBase {
	/** Restrict object usage according to whether we are currently in a hold */
	holdMode?: TimelineObjHoldMode
	/** Arbitrary data storage for plugins */
	metaData?: TMetadata
	/** Keyframes: Arbitrary data storage for plugins */
	keyframes?: CombineArrayType<
		TSR.TSRTimelineObjBase['keyframes'],
		{
			metaData?: TKeyframeMetadata
			/** Whether to keep this keyframe when the object is copied for lookahead. By default all keyframes are removed */
			preserveForLookahead?: boolean
		}
	>
}

/** TimelineObject extension for additional fields needed by onTimelineGenerate */
export interface OnGenerateTimelineObj<TMetadata = unknown, TKeyframeMetadata = unknown>
	extends TimelineObjectCoreExt<TMetadata, TKeyframeMetadata> {
	pieceInstanceId?: string
	infinitePieceId?: string
}
