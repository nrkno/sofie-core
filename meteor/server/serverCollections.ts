import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { createMongoCollection } from '../lib/collections/lib'
import { registerIndex } from '../lib/database'

export const Rundowns = createMongoCollection<DBRundown>(CollectionName.Rundowns)
registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})
