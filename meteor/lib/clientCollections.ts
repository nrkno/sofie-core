import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Bucket } from './collections/Buckets'
import { Evaluation } from './collections/Evaluations'
import { ExpectedPackageDB } from './collections/ExpectedPackages'
import { createSyncMongoCollection, createSyncReadOnlyMongoCollection } from './collections/lib'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const Blueprints = createSyncMongoCollection<Blueprint>(CollectionName.Blueprints)

export const BucketAdLibActions = createSyncReadOnlyMongoCollection<BucketAdLibAction>(
	CollectionName.BucketAdLibActions
)

export const BucketAdLibs = createSyncReadOnlyMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)

export const Buckets = createSyncReadOnlyMongoCollection<Bucket>(CollectionName.Buckets)

export const Evaluations = createSyncReadOnlyMongoCollection<Evaluation>(CollectionName.Evaluations)

export const ExpectedPackages = createSyncReadOnlyMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages)

export const ExpectedPackageWorkStatuses = createSyncReadOnlyMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses
)

export const ExternalMessageQueue = createSyncReadOnlyMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue
)

export const Rundowns = createSyncReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)

export const RundownPlaylists = createSyncReadOnlyMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)
