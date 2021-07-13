import { registerCollection } from '../lib'
import { TimelineObjGeneric } from './Timeline'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { RundownBaselineObjId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownBaselineObjId }

export interface RundownBaselineObj {
	_id: RundownBaselineObjId
	/** The rundown this timeline-object belongs to */
	rundownId: RundownId

	objects: TimelineObjGeneric[]
}

export const RundownBaselineObjs = createMongoCollection<RundownBaselineObj, RundownBaselineObj>('rundownBaselineObjs')
registerCollection('RundownBaselineObjs', RundownBaselineObjs)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})
