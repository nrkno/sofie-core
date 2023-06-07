import { TimelineObjectCoreExt } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { TSR } from '@sofie-automation/shared-lib/dist/tsr'

export { TSR }

export {
	TimelineObjHoldMode,
	TimelineObjectCoreExt,
	TimelineKeyframeCoreExt,
} from '@sofie-automation/shared-lib/dist/core/model/Timeline'

export enum TimelineObjClassesCore {
	RundownRehearsal = 'rundown_rehersal',
	RundownActive = 'rundown_active',
	BeforeFirstPart = 'before_first_part',
	NoNextPart = 'last_part',
}

/** TimelineObject extension for additional fields needed by onTimelineGenerate */
export interface OnGenerateTimelineObj<
	TContent extends { deviceType: TSR.DeviceType },
	TMetadata = unknown,
	TKeyframeMetadata = unknown
> extends TimelineObjectCoreExt<TContent, TMetadata, TKeyframeMetadata> {
	pieceInstanceId?: string
}

/**
 * A token to identify sessions that need an assignment, but won't be able to provide a unique id.
 * Instead, when this token is encountered, the id of the pieceInstance will be used instead of the name of the session.
 * Note: This doesnt play nice with transitions, so if they are required, then auto cannot be used
 */
export const AB_MEDIA_PLAYER_AUTO = '__auto__'
