import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { createClientMongoCollection } from './collections/lib'

export const Rundowns = createClientMongoCollection<DBRundown>(CollectionName.Rundowns)
