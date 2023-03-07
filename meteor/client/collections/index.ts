/**
 * This file contains or exports all of the 'client-side' mongo collections.
 * Note: This includes a re-export of some collections defined in `lib` which are used by `lib` code.
 * These are sync only and often read-only collections, for convenient use in client (minimongo) logic
 * where async is a burden and not a benefit.
 * The definitions must match the publications and server-collections (if applicable) that back them,
 * and will be stronger typed in the future.
 */

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { Meteor } from 'meteor/meteor'
import { Bucket } from '../../lib/collections/Buckets'
import { ICoreSystem, SYSTEM_ID } from '../../lib/collections/CoreSystem'
import { Evaluation } from '../../lib/collections/Evaluations'
import { ExpectedPackageDB } from '../../lib/collections/ExpectedPackages'
import {
	createSyncMongoCollection,
	createSyncReadOnlyMongoCollection,
	wrapMongoCollection,
} from '../../lib/collections/lib'
import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { SnapshotItem } from '../../lib/collections/Snapshots'
import { Studio } from '../../lib/collections/Studios'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { DBUser } from '../../lib/collections/Users'

// Future: remove the need for this
export * from '../../lib/collections/libCollections'

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

export const PackageContainerPackageStatuses = createSyncReadOnlyMongoCollection<PackageContainerPackageStatusDB>(
	CollectionName.PackageContainerPackageStatuses
)

export const PackageContainerStatuses = createSyncReadOnlyMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses
)

export const PackageInfos = createSyncReadOnlyMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)

export const PeripheralDevices = createSyncMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)

export const RundownLayouts = createSyncMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts)

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
