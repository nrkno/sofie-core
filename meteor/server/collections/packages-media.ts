import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { MediaObject } from '../../lib/collections/MediaObjects'
import { MediaWorkFlow } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowStep } from '../../lib/collections/MediaWorkFlowSteps'
import { createAsyncMongoCollection } from './collection'
import { registerIndex } from './indices'

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

export const MediaObjects = createAsyncMongoCollection<MediaObject>(CollectionName.MediaObjects)
registerIndex(MediaObjects, {
	studioId: 1,
	collectionId: 1,
	objId: 1,
	mediaId: 1,
})
registerIndex(MediaObjects, {
	studioId: 1,
	mediaId: 1,
})

export const MediaWorkFlows = createAsyncMongoCollection<MediaWorkFlow>(CollectionName.MediaWorkFlows)
registerIndex(MediaWorkFlows, {
	// TODO: add deviceId: 1,
	mediaObjectId: 1,
})
registerIndex(MediaWorkFlows, {
	finished: 1,
	success: 1,
	priority: 1,
})

export const MediaWorkFlowSteps = createAsyncMongoCollection<MediaWorkFlowStep>(CollectionName.MediaWorkFlowSteps)
registerIndex(MediaWorkFlowSteps, {
	deviceId: 1,
})
registerIndex(MediaWorkFlowSteps, {
	workFlowId: 1,
})
registerIndex(MediaWorkFlowSteps, {
	status: 1,
	priority: 1,
})

export const PackageContainerPackageStatuses = createAsyncMongoCollection<PackageContainerPackageStatusDB>(
	CollectionName.PackageContainerPackageStatuses
)
registerIndex(PackageContainerPackageStatuses, {
	studioId: 1,
	containerId: 1,
	packageId: 1,
})
registerIndex(PackageContainerPackageStatuses, {
	deviceId: 1,
})

export const PackageContainerStatuses = createAsyncMongoCollection<PackageContainerStatusDB>(
	CollectionName.PackageContainerStatuses
)
registerIndex(PackageContainerStatuses, {
	studioId: 1,
	containerId: 1,
})
registerIndex(PackageContainerStatuses, {
	deviceId: 1,
})

export const PackageInfos = createAsyncMongoCollection<PackageInfoDB>(CollectionName.PackageInfos)
registerIndex(PackageInfos, {
	studioId: 1,
	packageId: 1,
})
