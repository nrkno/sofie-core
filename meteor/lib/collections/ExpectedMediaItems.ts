import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
export * from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'

/** @deprecated */
export const ExpectedMediaItems = createMongoCollection<ExpectedMediaItem>(CollectionName.ExpectedMediaItems)

registerIndex(ExpectedMediaItems, {
	path: 1,
})
registerIndex(ExpectedMediaItems, {
	mediaFlowId: 1,
	studioId: 1,
})
registerIndex(ExpectedMediaItems, {
	rundownId: 1,
})
