import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

/** A string, identifying an AdLibActionId */
import { AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { AdLibActionId }

import { AdLibAction, AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
export { AdLibAction, AdLibActionCommon }

export const AdLibActions = createMongoCollection<AdLibAction, AdLibAction>('adLibActions')
registerCollection('AdLibActions', AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})
