import { RundownBaselineObjId, RundownId } from './Ids'
import { TimelineObjGeneric } from './Timeline'

export interface RundownBaselineObj {
	_id: RundownBaselineObjId
	/** The rundown this timeline-object belongs to */
	rundownId: RundownId

	objects: TimelineObjGeneric[]
}
