import { TimelineObjectCoreExt, TSR } from 'tv-automation-sofie-blueprints-integration'
import { TimelineObjId, TimelineObjType } from '../../../lib/collections/Timeline'
import { StudioId } from '../../../lib/collections/Studios'

export interface TimelineObjGeneric extends TimelineObjectCoreExt {
	/** Unique _id (generally obj.studioId + '_' + obj.id) */
	_id: TimelineObjId
	/** Unique within a timeline (ie within a studio) */
	id: string
	/** Set when the id of the object is prefixed */
	originalId?: string

	/** Studio installation Id */
	studioId: StudioId

	objectType: TimelineObjType

	enable: TSR.Timeline.TimelineEnable & { setFromNow?: boolean }

	/** The id of the group object this object is in  */
	inGroup?: string
}
