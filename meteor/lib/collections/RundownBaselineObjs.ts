import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'

export const RundownBaselineObjs = createMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects)

registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})
