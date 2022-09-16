import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { createClientMongoCollection } from './collections/lib'

export const Rundowns = createClientMongoCollection<DBRundown>(CollectionName.Rundowns)

export const RundownPlaylists = createClientMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
