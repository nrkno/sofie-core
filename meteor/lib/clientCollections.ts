import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { Meteor } from 'meteor/meteor'
import { Bucket } from './collections/Buckets'
import { ICoreSystem, SYSTEM_ID } from './collections/CoreSystem'
import { Evaluation } from './collections/Evaluations'
import { ExpectedPackageDB } from './collections/ExpectedPackages'
import { createSyncMongoCollection, createSyncReadOnlyMongoCollection, wrapMongoCollection } from './collections/lib'
import { DBOrganization } from './collections/Organization'
import { PartInstance } from './collections/PartInstances'
import { Part } from './collections/Parts'
import { PeripheralDeviceCommand } from './collections/PeripheralDeviceCommands'
import { PeripheralDevice } from './collections/PeripheralDevices'
import { RundownBaselineAdLibAction } from './collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibItem } from './collections/RundownBaselineAdLibPieces'
import { RundownLayoutBase } from './collections/RundownLayouts'
import { Segment } from './collections/Segments'
import { ShowStyleBase } from './collections/ShowStyleBases'
import { ShowStyleVariant } from './collections/ShowStyleVariants'
import { SnapshotItem } from './collections/Snapshots'
import { Studio } from './collections/Studios'
import { TranslationsBundle } from './collections/TranslationsBundles'
import { DBTriggeredActions } from './collections/TriggeredActions'
import { UserActionsLogItem } from './collections/UserActionsLog'
import { DBUser } from './collections/Users'

export const AdLibActions = createSyncReadOnlyMongoCollection<AdLibAction>(CollectionName.AdLibActions)

export const AdLibPieces = createSyncReadOnlyMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

export const Blueprints = createSyncMongoCollection<Blueprint>(CollectionName.Blueprints)

export const BucketAdLibActions = createSyncReadOnlyMongoCollection<BucketAdLibAction>(
	CollectionName.BucketAdLibActions
)

export const BucketAdLibs = createSyncReadOnlyMongoCollection<BucketAdLib>(CollectionName.BucketAdLibPieces)

export const Buckets = createSyncReadOnlyMongoCollection<Bucket>(CollectionName.Buckets)

export const CoreSystem = createSyncMongoCollection<ICoreSystem>(CollectionName.CoreSystem)

export const Evaluations = createSyncReadOnlyMongoCollection<Evaluation>(CollectionName.Evaluations)

export const ExpectedPackages = createSyncReadOnlyMongoCollection<ExpectedPackageDB>(CollectionName.ExpectedPackages)

export const ExpectedPackageWorkStatuses = createSyncReadOnlyMongoCollection<ExpectedPackageWorkStatus>(
	CollectionName.ExpectedPackageWorkStatuses
)

export const ExternalMessageQueue = createSyncReadOnlyMongoCollection<ExternalMessageQueueObj>(
	CollectionName.ExternalMessageQueue
)

export const MediaObjects = createSyncReadOnlyMongoCollection<MediaObject>(CollectionName.MediaObjects)

export const MediaWorkFlows = createSyncReadOnlyMongoCollection<MediaWorkFlow>(CollectionName.MediaWorkFlows)

export const MediaWorkFlowSteps = createSyncReadOnlyMongoCollection<MediaWorkFlowStep>(
	CollectionName.MediaWorkFlowSteps
)

export const Organizations = createSyncMongoCollection<DBOrganization>(CollectionName.Organizations)

export const PackageContainerPackageStatuses = createSyncReadOnlyMongoCollection<PackageContainerPackageStatusDB>(
	CollectionName.PackageContainerPackageStatuses
)

export const PackageContainerStatuses = createSyncReadOnlyMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses
)

export const PackageInfos = createSyncReadOnlyMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)

export const PartInstances = createSyncReadOnlyMongoCollection<PartInstance>(CollectionName.PartInstances)

export const Parts = createSyncReadOnlyMongoCollection<Part>(CollectionName.Parts)

export const PeripheralDeviceCommands = createSyncMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands
)

export const PeripheralDevices = createSyncMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)

export const PieceInstances = createSyncReadOnlyMongoCollection<PieceInstance>(CollectionName.PieceInstances)

export const Pieces = createSyncReadOnlyMongoCollection<Piece>(CollectionName.Pieces)

export const RundownBaselineAdLibActions = createSyncReadOnlyMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)

export const RundownBaselineAdLibPieces = createSyncReadOnlyMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)

export const RundownLayouts = createSyncMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts)

export const Rundowns = createSyncReadOnlyMongoCollection<DBRundown>(CollectionName.Rundowns)

export const RundownPlaylists = createSyncReadOnlyMongoCollection<DBRundownPlaylist>(CollectionName.RundownPlaylists)

export const Segments = createSyncReadOnlyMongoCollection<Segment>(CollectionName.Segments)

export const ShowStyleBases = createSyncMongoCollection<ShowStyleBase>(CollectionName.ShowStyleBases)

export const ShowStyleVariants = createSyncMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)

export const Snapshots = createSyncMongoCollection<SnapshotItem>(CollectionName.Snapshots)

export const Studios = createSyncMongoCollection<Studio>(CollectionName.Studios)

export const TranslationsBundles = createSyncReadOnlyMongoCollection<TranslationsBundle>(
	CollectionName.TranslationsBundles
)

export const TriggeredActions = createSyncMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions)

export const UserActionsLog = createSyncReadOnlyMongoCollection<UserActionsLogItem>(CollectionName.UserActionsLog)

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users = wrapMongoCollection<DBUser>(Meteor.users as any, CollectionName.Users)

export function getCoreSystem(): ICoreSystem | undefined {
	return CoreSystem.findOne(SYSTEM_ID)
}
