import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { createServerAsyncOnlyMongoCollection, createServerMongoCollection } from '../lib/collections/lib'
import { DBRundownPlaylist } from '../lib/collections/RundownPlaylists'
import { WorkerStatus } from '../lib/collections/Workers'
import { registerIndex } from '../lib/database'

export const IngestDataCache = createServerMongoCollection<IngestDataCacheObj>(CollectionName.IngestDataCache)
registerIndex(IngestDataCache, {
	rundownId: 1,
})

export const RundownBaselineObjs = createServerMongoCollection<RundownBaselineObj>(
	CollectionName.RundownBaselineObjects
)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})

export const Rundowns = createServerMongoCollection<DBRundown>(CollectionName.Rundowns)
registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})

export const RundownPlaylists = createServerMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})

export const Workers = createServerMongoCollection<WorkerStatus>(CollectionName.Workers)

export const WorkerThreadStatuses = createServerAsyncOnlyMongoCollection<WorkerThreadStatus>(
	CollectionName.WorkerThreads
)
