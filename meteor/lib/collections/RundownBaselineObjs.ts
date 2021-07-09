import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { RundownBaselineObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownBaselineObjId }

import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'

export const RundownBaselineObjs = createMongoCollection<RundownBaselineObj, RundownBaselineObj>('rundownBaselineObjs')
registerCollection('RundownBaselineObjs', RundownBaselineObjs)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})
