import { Meteor } from 'meteor/meteor'
import { AdLibAction } from '../collections/AdLibActions'
import { AdLibPiece } from '../collections/AdLibPieces'
import { Blueprint } from '../collections/Blueprints'
import { BucketAdLibAction } from '../collections/BucketAdlibActions'
import { BucketAdLib } from '../collections/BucketAdlibs'
import { Bucket } from '../collections/Buckets'
import { ICoreSystem } from '../collections/CoreSystem'
import { Evaluation } from '../collections/Evaluations'
import { ExpectedMediaItem } from '../collections/ExpectedMediaItems'
import { ExpectedPackageDB, ExpectedPackageId } from '../collections/ExpectedPackages'
import { ExpectedPackageWorkStatus } from '../collections/ExpectedPackageWorkStatuses'
import { ExpectedPlayoutItem } from '../collections/ExpectedPlayoutItems'
import { ExternalMessageQueueObj } from '../collections/ExternalMessageQueue'
import { IngestDataCacheObj } from '../collections/IngestDataCache'
import { MediaObject } from '../collections/MediaObjects'
import { MediaWorkFlow } from '../collections/MediaWorkFlows'
import { MediaWorkFlowStep } from '../collections/MediaWorkFlowSteps'
import { DBOrganization } from '../collections/Organization'
import { PackageContainerPackageStatusDB } from '../collections/PackageContainerPackageStatus'
import { PackageContainerStatusDB } from '../collections/PackageContainerStatus'
import { PackageInfoDB } from '../collections/PackageInfos'
import { PartInstance } from '../collections/PartInstances'
import { DBPart } from '../collections/Parts'
import { PeripheralDeviceCommand } from '../collections/PeripheralDeviceCommands'
import { PeripheralDevice, PeripheralDeviceId } from '../collections/PeripheralDevices'
import { PieceInstance } from '../collections/PieceInstances'
import { Piece } from '../collections/Pieces'
import { RundownBaselineAdLibAction } from '../collections/RundownBaselineAdLibActions'
import { RundownBaselineAdLibItem } from '../collections/RundownBaselineAdLibPieces'
import { RundownLayoutBase } from '../collections/RundownLayouts'
import { DBRundownPlaylist } from '../collections/RundownPlaylists'
import { DBRundown } from '../collections/Rundowns'
import { DBSegment } from '../collections/Segments'
import { DBShowStyleBase } from '../collections/ShowStyleBases'
import { DBShowStyleVariant } from '../collections/ShowStyleVariants'
import { SnapshotItem } from '../collections/Snapshots'
import { DBStudio, RoutedMappings, StudioId } from '../collections/Studios'
import { RoutedTimeline, TimelineComplete } from '../collections/Timeline'
import { TranslationsBundle } from '../collections/TranslationsBundles'
import { DBTriggeredActions } from '../collections/TriggeredActions'
import { UserActionsLogItem } from '../collections/UserActionsLog'
import { DBUser } from '../collections/Users'
import { DBObj } from '../lib'
import { MongoQuery } from '../typings/meteor'

export enum PubSub {
	blueprints = 'blueprints',
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedPlayoutItems = 'expectedPlayoutItems',
	expectedMediaItems = 'expectedMediaItems',
	externalMessageQueue = 'externalMessageQueue',
	mediaObjects = 'mediaObjects',
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	peripheralDevices = 'peripheralDevices',
	peripheralDevicesAndSubDevices = ' peripheralDevicesAndSubDevices',
	rundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	rundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	ingestDataCache = 'ingestDataCache',
	rundownPlaylists = 'rundownPlaylists',
	rundowns = 'rundowns',
	adLibActions = 'adLibActions',
	adLibPieces = 'adLibPieces',
	pieces = 'pieces',
	pieceInstances = 'pieceInstances',
	pieceInstancesSimple = 'pieceInstancesSimple',
	parts = 'parts',
	partInstances = 'partInstances',
	partInstancesSimple = 'partInstancesSimple',
	partInstancesForSegmentPlayout = 'partInstancesForSegmentPlayout',
	segments = 'segments',
	showStyleBases = 'showStyleBases',
	showStyleVariants = 'showStyleVariants',
	triggeredActions = 'triggeredActions',
	snapshots = 'snapshots',
	studios = 'studios',
	studioOfDevice = 'studioOfDevice',
	timeline = 'timeline',
	userActionsLog = 'userActionsLog',
	/** @deprecated */
	mediaWorkFlows = 'mediaWorkFlows',
	/** @deprecated */
	mediaWorkFlowSteps = 'mediaWorkFlowSteps',
	rundownLayouts = 'rundownLayouts',
	loggedInUser = 'loggedInUser',
	usersInOrganization = 'usersInOrganization',
	organization = 'organization',
	buckets = 'buckets',
	bucketAdLibPieces = 'bucketAdLibPieces',
	translationsBundles = 'translationsBundles',
	bucketAdLibActions = 'bucketAdLibActions',
	expectedPackages = 'expectedPackages',
	expectedPackageWorkStatuses = 'expectedPackageWorkStatuses',
	packageContainerPackageStatuses = 'packageContainerPackageStatuses',
	packageContainerStatuses = 'packageContainerStatuses',
	packageInfos = 'packageInfos',
	// custom publications:
	mappingsForDevice = 'mappingsForDevice',
	timelineForDevice = 'timelineForDevice',
	mappingsForStudio = 'mappingsForStudio',
	timelineForStudio = 'timelineForStudio',
	expectedPackagesForDevice = 'expectedPackagesForDevice',
}

export interface PubSubTypes {
	[PubSub.blueprints]: (selector: MongoQuery<Blueprint>, token: string | undefined) => Blueprint
	[PubSub.coreSystem]: (token: string | undefined) => ICoreSystem
	[PubSub.evaluations]: (selector: MongoQuery<Evaluation>, token: string | undefined) => Evaluation
	[PubSub.expectedPlayoutItems]: (
		selector: MongoQuery<ExpectedPlayoutItem>,
		token: string | undefined
	) => ExpectedPlayoutItem
	[PubSub.expectedMediaItems]: (
		selector: MongoQuery<ExpectedMediaItem>,
		token: string | undefined
	) => ExpectedMediaItem
	[PubSub.externalMessageQueue]: (
		selector: MongoQuery<ExternalMessageQueueObj>,
		token: string | undefined
	) => ExternalMessageQueueObj
	[PubSub.mediaObjects]: (
		studioId: StudioId,
		selector: MongoQuery<MediaObject>,
		token: string | undefined
	) => MediaObject
	[PubSub.peripheralDeviceCommands]: (
		deviceId: PeripheralDeviceId,
		token: string | undefined
	) => PeripheralDeviceCommand
	[PubSub.peripheralDevices]: (selector: MongoQuery<PeripheralDevice>, token: string | undefined) => PeripheralDevice
	[PubSub.peripheralDevicesAndSubDevices]: (
		selector: MongoQuery<PeripheralDevice>,
		token: string | undefined
	) => PeripheralDevice
	[PubSub.rundownBaselineAdLibPieces]: (
		selector: MongoQuery<RundownBaselineAdLibItem>,
		token: string | undefined
	) => RundownBaselineAdLibItem
	[PubSub.rundownBaselineAdLibActions]: (
		selector: MongoQuery<RundownBaselineAdLibAction>,
		token: string | undefined
	) => RundownBaselineAdLibAction
	[PubSub.ingestDataCache]: (
		selector: MongoQuery<IngestDataCacheObj>,
		token: string | undefined
	) => IngestDataCacheObj
	[PubSub.rundownPlaylists]: (selector: MongoQuery<DBRundownPlaylist>, token: string | undefined) => DBRundownPlaylist
	[PubSub.rundowns]: (selector: MongoQuery<DBRundown>, token: string | undefined) => DBRundown
	[PubSub.adLibActions]: (selector: MongoQuery<AdLibAction>, token: string | undefined) => AdLibAction
	[PubSub.adLibPieces]: (selector: MongoQuery<AdLibPiece>, token: string | undefined) => AdLibPiece
	[PubSub.pieces]: (selector: MongoQuery<Piece>, token: string | undefined) => Piece
	[PubSub.pieceInstances]: (selector: MongoQuery<PieceInstance>, token: string | undefined) => PieceInstance
	[PubSub.pieceInstancesSimple]: (selector: MongoQuery<PieceInstance>, token: string | undefined) => PieceInstance
	[PubSub.parts]: (selector: MongoQuery<DBPart>, token: string | undefined) => DBPart
	[PubSub.partInstances]: (selector: MongoQuery<PartInstance>, token: string | undefined) => PartInstance
	[PubSub.partInstancesSimple]: (selector: MongoQuery<PartInstance>, token: string | undefined) => PartInstance
	[PubSub.partInstancesForSegmentPlayout]: (
		selector: MongoQuery<PartInstance>,
		token: string | undefined
	) => PartInstance
	[PubSub.segments]: (selector: MongoQuery<DBSegment>, token: string | undefined) => DBSegment
	[PubSub.showStyleBases]: (selector: MongoQuery<DBShowStyleBase>, token: string | undefined) => DBShowStyleBase
	[PubSub.showStyleVariants]: (
		selector: MongoQuery<DBShowStyleVariant>,
		token: string | undefined
	) => DBShowStyleVariant
	[PubSub.triggeredActions]: (
		selector: MongoQuery<DBTriggeredActions>,
		token: string | undefined
	) => DBTriggeredActions
	[PubSub.snapshots]: (selector: MongoQuery<SnapshotItem>, token: string | undefined) => SnapshotItem
	[PubSub.studios]: (selector: MongoQuery<DBStudio>, token: string | undefined) => DBStudio
	[PubSub.studioOfDevice]: (deviceId: PeripheralDeviceId, token: string | undefined) => DBStudio
	[PubSub.timeline]: (selector: MongoQuery<TimelineComplete>, token: string | undefined) => TimelineComplete
	[PubSub.userActionsLog]: (selector: MongoQuery<UserActionsLogItem>, token: string | undefined) => UserActionsLogItem
	/** @deprecated */
	[PubSub.mediaWorkFlows]: (selector: MongoQuery<MediaWorkFlow>, token: string | undefined) => MediaWorkFlow
	/** @deprecated */
	[PubSub.mediaWorkFlowSteps]: (
		selector: MongoQuery<MediaWorkFlowStep>,
		token: string | undefined
	) => MediaWorkFlowStep
	[PubSub.rundownLayouts]: (selector: MongoQuery<RundownLayoutBase>, token: string | undefined) => RundownLayoutBase
	[PubSub.loggedInUser]: (token: string | undefined) => DBUser
	[PubSub.usersInOrganization]: (selector: MongoQuery<DBUser>, token: string | undefined) => DBUser
	[PubSub.organization]: (selector: MongoQuery<DBOrganization>, token: string | undefined) => DBOrganization
	[PubSub.buckets]: (selector: MongoQuery<Bucket>, token: string | undefined) => Bucket
	[PubSub.bucketAdLibPieces]: (selector: MongoQuery<BucketAdLib>, token: string | undefined) => BucketAdLib
	[PubSub.bucketAdLibActions]: (
		selector: MongoQuery<BucketAdLibAction>,
		token: string | undefined
	) => BucketAdLibAction
	[PubSub.translationsBundles]: (
		selector: MongoQuery<TranslationsBundle>,
		token: string | undefined
	) => TranslationsBundle
	[PubSub.expectedPackages]: (selector: MongoQuery<ExpectedPackageDB>, token: string | undefined) => ExpectedPackageDB
	[PubSub.expectedPackageWorkStatuses]: (
		selector: MongoQuery<ExpectedPackageWorkStatus>,
		token: string | undefined
	) => ExpectedPackageWorkStatus
	[PubSub.packageContainerPackageStatuses]: (
		studioId: StudioId,
		containerId?: string | null,
		packageId?: ExpectedPackageId | null
	) => PackageContainerPackageStatusDB
	[PubSub.packageContainerStatuses]: (
		selector: MongoQuery<PackageContainerStatusDB>,
		token: string | undefined
	) => PackageContainerStatusDB
	[PubSub.packageInfos]: (selector: MongoQuery<PackageInfoDB>, token: string | undefined) => PackageInfoDB

	// custom publications:
	[PubSub.mappingsForDevice]: (deviceId: PeripheralDeviceId, token: string | undefined) => RoutedMappings
	[PubSub.timelineForDevice]: (deviceId: PeripheralDeviceId, token: string | undefined) => RoutedTimeline
	[PubSub.mappingsForStudio]: (studioId: StudioId, token: string | undefined) => RoutedMappings
	[PubSub.timelineForStudio]: (studioId: StudioId, token: string | undefined) => RoutedTimeline
	[PubSub.expectedPackagesForDevice]: (
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token: string | undefined
	) => DBObj
}

export function meteorSubscribe(name: PubSub, ...args: any[]): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		return Meteor.subscribe(name, ...args)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
