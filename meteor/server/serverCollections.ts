import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { Bucket } from '../lib/collections/Buckets'
import { Evaluation } from '../lib/collections/Evaluations'
import { ExpectedPackageDB } from '../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '../lib/collections/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '../lib/collections/ExpectedPlayoutItems'
import { createAsyncOnlyMongoCollection, createAsyncMongoCollection } from '../lib/collections/lib'
import { WorkerStatus } from '../lib/collections/Workers'
import { registerIndex } from '../lib/database'

export const AdLibActions = createAsyncMongoCollection<AdLibAction>(CollectionName.AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})

export const AdLibPieces = createAsyncMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)
registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})

export const Blueprints = createAsyncMongoCollection<Blueprint>(CollectionName.Blueprints)
registerIndex(Blueprints, {
	organizationId: 1,
})

export const BucketAdLibActions = createAsyncMongoCollection<BucketAdLibAction>(CollectionName.BucketAdLibActions)
registerIndex(BucketAdLibActions, {
	bucketId: 1,
	studioId: 1,
})

export const BucketAdLibs = createAsyncMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)
registerIndex(BucketAdLibs, {
	bucketId: 1,
	studioId: 1,
})

export const Buckets = createAsyncMongoCollection<Bucket>(CollectionName.Buckets)
registerIndex(Buckets, {
	studioId: 1,
})

export const Evaluations = createAsyncMongoCollection<Evaluation>(CollectionName.Evaluations)
registerIndex(Evaluations, {
	organizationId: 1,
	timestamp: 1,
})

/** @deprecated */
export const ExpectedMediaItems = createAsyncMongoCollection<ExpectedMediaItem>(CollectionName.ExpectedMediaItems)
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

export const ExpectedPackages = createAsyncMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages)
registerIndex(ExpectedPackages, {
	studioId: 1,
	fromPieceType: 1,
})
registerIndex(ExpectedPackages, {
	studioId: 1,
	pieceId: 1,
})
registerIndex(ExpectedPackages, {
	rundownId: 1,
	pieceId: 1,
})

export const ExpectedPackageWorkStatuses = createAsyncMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses
)
registerIndex(ExpectedPackageWorkStatuses, {
	studioId: 1,
	// fromPackages: 1,
})
// registerIndex(ExpectedPackageWorkStatuses, {
// 	deviceId: 1,
// })

/** @deprecated */
export const ExpectedPlayoutItems = createAsyncMongoCollection<ExpectedPlayoutItem>(CollectionName.ExpectedPlayoutItems)
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

export const ExternalMessageQueue = createAsyncMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue
)
registerIndex(ExternalMessageQueue, {
	studioId: 1,
	created: 1,
})
registerIndex(ExternalMessageQueue, {
	sent: 1,
	lastTry: 1,
})
registerIndex(ExternalMessageQueue, {
	studioId: 1,
	rundownId: 1,
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
