import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ExpectedPlayoutItemId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ExpectedPlayoutItemId }

import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
export * from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'

/** @deprecated */
export const ExpectedPlayoutItems = createMongoCollection<ExpectedPlayoutItem, ExpectedPlayoutItem>(
	'expectedPlayoutItems'
)
registerCollection('ExpectedPlayoutItems', ExpectedPlayoutItems)

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
