import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

/** A string, identifying an AdLibActionId */
import { AdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { AdLibActionId }

import { AdLibAction, AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export { AdLibAction, AdLibActionCommon }

export const AdLibActions = createMongoCollection<AdLibAction>(CollectionName.AdLibActions)

registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})
