import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { createClientMongoReadOnlyCollection } from './collections/lib'

export const Rundowns = createClientMongoReadOnlyCollection<DBRundown>(CollectionName.Rundowns)

export const RundownPlaylists = createClientMongoReadOnlyCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
