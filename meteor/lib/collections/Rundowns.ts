import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { RundownId }

import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
export { RundownHoldState }

import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
export * from '@sofie-automation/corelib/dist/dataModel/Rundown'

// export const Rundowns = createMongoCollection<Rundown>('rundowns', {transform: (doc) => applyClassToDocument(Rundown, doc) })
export const Rundowns = createMongoCollection<DBRundown>(CollectionName.Rundowns)

registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})
