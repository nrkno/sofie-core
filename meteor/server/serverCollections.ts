import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { createAsyncOnlyMongoCollection, createAsyncMongoCollection } from '../lib/collections/lib'
import { WorkerStatus } from '../lib/collections/Workers'
import { registerIndex } from '../lib/database'

export const Blueprints = createAsyncMongoCollection<Blueprint>(CollectionName.Blueprints)
registerIndex(Blueprints, {
	organizationId: 1,
})

export const IngestDataCache = createAsyncMongoCollection<IngestDataCacheObj>(CollectionName.IngestDataCache)
registerIndex(IngestDataCache, {
	rundownId: 1,
})

export const RundownBaselineObjs = createAsyncMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})

export const Rundowns = createAsyncMongoCollection<DBRundown>(CollectionName.Rundowns)
registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})

export const RundownPlaylists = createAsyncMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
registerIndex(RundownPlaylists, {
	studioId: 1,
	activationId: 1,
})

export const Workers = createAsyncMongoCollection<WorkerStatus>(CollectionName.Workers)

export const WorkerThreadStatuses = createAsyncOnlyMongoCollection<WorkerThreadStatus>(CollectionName.WorkerThreads)
