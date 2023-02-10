import { ProtectedString } from '../protectedString'

/** A string, identifying an activation of a playlist */
export type ActiveInstanceId = ProtectedString<'ActiveInstanceId'>
/** A string, identifying an activation of a playlist */
export type RundownPlaylistActivationId = ProtectedString<'RundownPlaylistActivationId'>

/** An id, representing the currently running instance of this process */
export type SystemInstanceId = ProtectedString<'SystemInstanceId'>

/** A string, identifying an AdLibActionId */
export type AdLibActionId = ProtectedString<'AdLibActionId'>

/** A string, identifying a Blueprint */
export type BlueprintId = ProtectedString<'BlueprintId'>

export type BucketId = ProtectedString<'BucketId'>
export type BucketAdLibId = PieceId
export type BucketAdLibActionId = AdLibActionId

/** A string, identifying a CoreSystem */
export type CoreSystemId = ProtectedString<'CoreSystemId'>

/** A string, identifying a Evaluation */
export type EvaluationId = ProtectedString<'EvaluationId'>

/** A string, identifying a ExpectedMediaItem
 * @deprecated
 */
export type ExpectedMediaItemId = ProtectedString<'ExpectedMediaItemId'>

/** A string, identifying a Rundown
 * @deprecated
 */
export type ExpectedPlayoutItemId = ProtectedString<'ExpectedPlayoutItemId'>

/** A string, identifying a ExternalMessageQueueObj */
export type ExternalMessageQueueObjId = ProtectedString<'ExternalMessageQueueObjId'>

/** A string, identifying a IngestDataCacheObj */
export type IngestDataCacheObjId = ProtectedString<'IngestDataCacheObjId'>

/** A string, identifying a Organization */
export type OrganizationId = ProtectedString<'OrganizationId'>

export type PackageInfoId = ProtectedString<'PackageInfoId'>

/** Id of a package container */
export type PackageContainerId = ProtectedString<'PackageContainerId'>

/** Id of a package container */
export type PackageContainerPackageId = ProtectedString<'PackageContainerPackageId'>

export type SegmentPlayoutId = ProtectedString<'SegmentPlayoutId'>

/** A string, identifying a Part */
export type PartId = ProtectedString<'PartId'>

export type PieceInstanceInfiniteId = ProtectedString<'PieceInstanceInfiniteId'>

/** A string, identifying a Piece */
export type PieceId = ProtectedString<'PieceId'>

/** A string, identifying an RundownBaselineAdLibActionId */
export type RundownBaselineAdLibActionId = ProtectedString<'RundownBaselineAdLibActionId'>

/** A string, identifying a RundownBaselineObj */
export type RundownBaselineObjId = ProtectedString<'RundownBaselineObjId'>

/** A string, identifying a RundownLayout */
export type RundownLayoutId = ProtectedString<'RundownLayoutId'>

/** A string, identifying a Rundown */
export type RundownId = ProtectedString<'RundownId'>

/** A string, identifying a Segment */
export type SegmentId = ProtectedString<'SegmentId'>

/** A string, identifying a ShowStyleBase */
export type ShowStyleBaseId = ProtectedString<'ShowStyleBaseId'>
/** A string, identifying a ShowStyleVariant */
export type ShowStyleVariantId = ProtectedString<'ShowStyleVariantId'>

/** A string, identifying a Snapshot */
export type SnapshotId = ProtectedString<'SnapshotId'>

/** A string, identifying a TimelineObj */
export type TimelineObjId = ProtectedString<'TimelineObjId'>

/** A string identifying a translations bundle */
export type TranslationsBundleId = ProtectedString<'TranslationsBundleId'>

/** A string identifying a triggered action */
export type TriggeredActionId = ProtectedString<'TriggeredActionId'>

/** A string, identifying a UserActionsLogItem */
export type UserActionsLogItemId = ProtectedString<'UserActionsLogItemId'>

/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>

/** A string, identifying a Worker (parent) */
export type WorkerId = ProtectedString<'WorkerId'>

/** A string, identifying a WorkerThread */
export type WorkerThreadId = ProtectedString<'WorkerThreadId'>

/** A string, identifyinf a TimelineDatastore entry */
export type TimelineDatastoreEntryId = ProtectedString<'TimelineDatastoreEntryId'>

export * from '@sofie-automation/shared-lib/dist/core/model/Ids'
