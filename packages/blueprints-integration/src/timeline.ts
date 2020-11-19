import * as TSR from 'timeline-state-resolver-types'
import { CombineArrayType } from './lib'
export { TSR }

export { Timeline } from 'timeline-state-resolver-types'

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
}
