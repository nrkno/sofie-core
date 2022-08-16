import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { RundownBaselineAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownBaselineAdLibActionId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'

export const RundownBaselineAdLibActions = createMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)

registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})
