import { AdLibActionCommon } from './AdLibActions'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { RundownBaselineAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownBaselineAdLibActionId }

export interface RundownBaselineAdLibAction extends AdLibActionCommon {
	_id: RundownBaselineAdLibActionId
}

export const RundownBaselineAdLibActions = createMongoCollection<
	RundownBaselineAdLibAction,
	RundownBaselineAdLibAction
>('rundownBaselineAdLibActions')
registerCollection('RundownBaselineAdLibActions', RundownBaselineAdLibActions)
registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})
