import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { RundownBaselineAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownBaselineAdLibActionId }

import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'

export const RundownBaselineAdLibActions = createMongoCollection<
	RundownBaselineAdLibAction,
	RundownBaselineAdLibAction
>('rundownBaselineAdLibActions')
registerCollection('RundownBaselineAdLibActions', RundownBaselineAdLibActions)
registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})
