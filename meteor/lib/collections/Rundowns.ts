import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
export * from '@sofie-automation/corelib/dist/dataModel/Rundown'

export const Rundowns = createMongoCollection<DBRundown>(CollectionName.Rundowns)

registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})
