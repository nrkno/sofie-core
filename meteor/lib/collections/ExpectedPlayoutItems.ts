import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
export * from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'

/** @deprecated */
export const ExpectedPlayoutItems = createMongoCollection<ExpectedPlayoutItem>(CollectionName.ExpectedPlayoutItems)

registerIndex(ExpectedPlayoutItems, {
	studioId: 1,
})
registerIndex(ExpectedPlayoutItems, {
	rundownId: 1,
})
registerIndex(ExpectedPlayoutItems, {
	studioId: 1,
	baseline: 1,
})
