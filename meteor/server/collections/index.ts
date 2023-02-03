import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { PackageContainerPackageStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { Meteor } from 'meteor/meteor'
import { Bucket } from '../../lib/collections/Buckets'
import { ICoreSystem } from '../../lib/collections/CoreSystem'
import { Evaluation } from '../../lib/collections/Evaluations'
import { ExpectedPackageDB } from '../../lib/collections/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '../../lib/collections/ExpectedPlayoutItems'
import {
	createAsyncOnlyMongoCollection,
	createAsyncMongoCollection,
	ObserveChangesForHash,
	wrapMongoCollection,
} from '../../lib/collections/lib'
import { DBOrganization } from '../../lib/collections/Organization'
import { PartInstance } from '../../lib/collections/PartInstances'
import { Part } from '../../lib/collections/Parts'
import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { Segment } from '../../lib/collections/Segments'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { SnapshotItem } from '../../lib/collections/Snapshots'
import { Studio } from '../../lib/collections/Studios'
import { TimelineComplete } from '../../lib/collections/Timeline'
import { TimelineDatastoreEntry } from '../../lib/collections/TimelineDatastore'
import { TranslationsBundle } from '../../lib/collections/TranslationsBundles'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { DBUser } from '../../lib/collections/Users'
import { WorkerStatus } from '../../lib/collections/Workers'
import { registerIndex } from '../../lib/database'
import { getCurrentTime, registerCollection } from '../../lib/lib'

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

export const CoreSystem = createAsyncMongoCollection<ICoreSystem>(CollectionName.CoreSystem)

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

export const Organizations = createAsyncMongoCollection<DBOrganization>(CollectionName.Organizations)

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

export const PartInstances = createAsyncMongoCollection<PartInstance>(CollectionName.PartInstances)
registerIndex(PartInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	segmentId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	takeCount: 1,
	reset: 1,
})
registerIndex(PartInstances, {
	rundownId: 1,
	// @ts-expect-error deep property
	'part._id': 1,
	takeCount: 1,
	reset: 1,
})

export const Parts = createAsyncMongoCollection<Part>(CollectionName.Parts)
registerIndex(Parts, {
	rundownId: 1,
	segmentId: 1,
	_rank: 1,
})
registerIndex(Parts, {
	rundownId: 1,
	_rank: 1,
})

export const PeripheralDeviceCommands = createAsyncMongoCollection<PeripheralDeviceCommand>(
	CollectionName.PeripheralDeviceCommands
)
registerIndex(PeripheralDeviceCommands, {
	deviceId: 1,
})

export const PeripheralDevices = createAsyncMongoCollection<PeripheralDevice>(CollectionName.PeripheralDevices)
registerIndex(PeripheralDevices, {
	organizationId: 1,
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	studioId: 1,
})
registerIndex(PeripheralDevices, {
	token: 1,
})

export const PieceInstances = createAsyncMongoCollection<PieceInstance>(CollectionName.PieceInstances)
registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
registerIndex(PieceInstances, {
	rundownId: 1,
	playlistActivationId: 1,
	partInstanceId: 1,
	reset: -1,
})

export const Pieces = createAsyncMongoCollection<Piece>(CollectionName.Pieces)
registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})
registerIndex(Pieces, {
	startRundownId: 1,
	startPartId: 1,
})

export const RundownBaselineAdLibActions = createAsyncMongoCollection<RundownBaselineAdLibAction>(
	CollectionName.RundownBaselineAdLibActions
)
registerIndex(RundownBaselineAdLibActions, {
	rundownId: 1,
})

export const RundownBaselineAdLibPieces = createAsyncMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})

export const RundownBaselineObjs = createAsyncMongoCollection<RundownBaselineObj>(CollectionName.RundownBaselineObjects)
registerIndex(RundownBaselineObjs, {
	rundownId: 1,
})

export const RundownLayouts = createAsyncMongoCollection<RundownLayoutBase>(CollectionName.RundownLayouts)
// addIndex(RundownLayouts, {
// 	studioId: 1,
// 	collectionId: 1,
// 	objId: 1,
// 	mediaId: 1
// })
registerIndex(RundownLayouts, {
	showStyleBaseId: 1,
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

export const Segments = createAsyncMongoCollection<Segment>(CollectionName.Segments)
registerIndex(Segments, {
	rundownId: 1,
	_rank: 1,
})

export const ShowStyleBases = createAsyncMongoCollection<ShowStyleBase>(CollectionName.ShowStyleBases)
registerIndex(ShowStyleBases, {
	organizationId: 1,
})

export const ShowStyleVariants = createAsyncMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)
registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
	_rank: 1,
})

export const Snapshots = createAsyncMongoCollection<SnapshotItem>(CollectionName.Snapshots)
registerIndex(Snapshots, {
	organizationId: 1,
})
registerIndex(Snapshots, {
	created: 1,
})

export const Studios = createAsyncMongoCollection<Studio>(CollectionName.Studios)
registerIndex(Studios, {
	organizationId: 1,
})

export const Timeline = createAsyncMongoCollection<TimelineComplete>(CollectionName.Timelines)
// Note: this index is always created by default, so it's not needed.
// registerIndex(Timeline, {
// 	_id: 1,
// })

export const TimelineDatastore = createAsyncMongoCollection<TimelineDatastoreEntry>(CollectionName.TimelineDatastore)
registerIndex(TimelineDatastore, {
	studioId: 1,
})

export const TranslationsBundles = createAsyncMongoCollection<TranslationsBundle>(CollectionName.TranslationsBundles)

export const TriggeredActions = createAsyncMongoCollection<DBTriggeredActions>(CollectionName.TriggeredActions)
registerIndex(TriggeredActions, {
	showStyleBaseId: 1,
})

export const UserActionsLog = createAsyncMongoCollection<UserActionsLogItem>(CollectionName.UserActionsLog)
registerIndex(UserActionsLog, {
	organizationId: 1,
	timestamp: 1,
})
registerIndex(UserActionsLog, {
	timelineHash: 1,
})

// This is a somewhat special collection, as it draws from the Meteor.users collection from the Accounts package
export const Users = wrapMongoCollection<DBUser>(Meteor.users as any, CollectionName.Users)
registerCollection(CollectionName.Users, Users)
registerIndex(Users, {
	organizationId: 1,
})

export const Workers = createAsyncMongoCollection<WorkerStatus>(CollectionName.Workers)

export const WorkerThreadStatuses = createAsyncOnlyMongoCollection<WorkerThreadStatus>(CollectionName.WorkerThreads)

// Monitor and remove old, lingering commands:
const removeOldCommands = () => {
	PeripheralDeviceCommands.find().forEach((cmd) => {
		if (getCurrentTime() - (cmd.time || 0) > 20 * 1000) {
			// timeout a long time ago
			PeripheralDeviceCommands.remove(cmd._id)
		}
	})
}
Meteor.startup(() => {
	Meteor.setInterval(() => {
		removeOldCommands()
	}, 5 * 60 * 1000)

	ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfigWithOverrides', 'blueprintId'])

	ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['blueprintConfigWithOverrides', 'showStyleBaseId'])

	ObserveChangesForHash(Studios, '_rundownVersionHash', ['blueprintConfigWithOverrides'])
})
