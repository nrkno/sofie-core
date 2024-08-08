import { DBPart } from './dataModel/Part'
import { CollectionName } from './dataModel/Collections'
import { AdLibAction } from './dataModel/AdlibAction'
import { AdLibPiece } from './dataModel/AdLibPiece'
import { RundownBaselineAdLibAction } from './dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from './dataModel/RundownBaselineAdLibPiece'
import { DBPartInstance } from './dataModel/PartInstance'
import { DBRundown } from './dataModel/Rundown'
import { DBRundownPlaylist } from './dataModel/RundownPlaylist'
import { DBSegment } from './dataModel/Segment'
import { DBShowStyleBase } from './dataModel/ShowStyleBase'
import { DBShowStyleVariant } from './dataModel/ShowStyleVariant'
import { DBStudio } from './dataModel/Studio'
import { IngestDataCacheObj } from './dataModel/IngestDataCache'
import { DBTimelineDatastoreEntry } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { Blueprint } from './dataModel/Blueprint'
import { BucketAdLibAction } from './dataModel/BucketAdLibAction'
import { BucketAdLib } from './dataModel/BucketAdLibPiece'
import { ExpectedMediaItem } from './dataModel/ExpectedMediaItem'
import { ExpectedPackageWorkStatus } from './dataModel/ExpectedPackageWorkStatuses'
import { ExpectedPackageDBBase } from './dataModel/ExpectedPackages'
import { ExternalMessageQueueObj } from './dataModel/ExternalMessageQueue'
import { PackageContainerStatusDB } from './dataModel/PackageContainerStatus'
import { PeripheralDevice } from './dataModel/PeripheralDevice'
import { Piece } from './dataModel/Piece'
import { PieceInstance } from './dataModel/PieceInstance'
import { TimelineComplete } from './dataModel/Timeline'
import { PackageInfoDB } from './dataModel/PackageInfos'

// This is a hack, this contains R50 compatible pubsub definitions. To be replaced with R51 ones.
export enum CorelibPubSub {
	blueprints = 'blueprints',
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedPlayoutItems = 'expectedPlayoutItems',
	expectedMediaItems = 'expectedMediaItems',
	externalMessageQueue = 'externalMessageQueue',
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
	timeline = 'timeline',
	timelineDatastore = 'timelineDatastore',
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
	packageContainerStatuses = 'packageContainerStatuses',
	packageInfos = 'packageInfos',

	// For a PeripheralDevice
	rundownsForDevice = 'rundownsForDevice',

	// custom publications:
	peripheralDeviceForDevice = 'peripheralDeviceForDevice',
	mappingsForDevice = 'mappingsForDevice',
	timelineForDevice = 'timelineForDevice',
	timelineDatastoreForDevice = 'timelineDatastoreForDevice',
	mappingsForStudio = 'mappingsForStudio',
	timelineForStudio = 'timelineForStudio',

	uiShowStyleBase = 'uiShowStyleBase',
	uiStudio = 'uiStudio',
	uiTriggeredActions = 'uiTriggeredActions',

	mountedTriggersForDevice = 'mountedTriggersForDevice',
	mountedTriggersForDevicePreview = 'mountedTriggersForDevicePreview',
	deviceTriggersPreview = 'deviceTriggersPreview',

	uiSegmentPartNotes = 'uiSegmentPartNotes',
	uiPieceContentStatuses = 'uiPieceContentStatuses',
	uiBucketContentStatuses = 'uiBucketContentStatuses',

	packageManagerPlayoutContext = 'packageManagerPlayoutContext',
	packageManagerPackageContainers = 'packageManagerPackageContainers',
	packageManagerExpectedPackages = 'packageManagerExpectedPackages',
}

export type CorelibPubSubCollections = {
	[CollectionName.AdLibActions]: AdLibAction
	[CollectionName.AdLibPieces]: AdLibPiece
	[CollectionName.Blueprints]: Blueprint
	[CollectionName.BucketAdLibActions]: BucketAdLibAction
	[CollectionName.BucketAdLibPieces]: BucketAdLib
	[CollectionName.ExpectedMediaItems]: ExpectedMediaItem
	[CollectionName.ExpectedPackages]: ExpectedPackageDBBase
	[CollectionName.ExpectedPackageWorkStatuses]: ExpectedPackageWorkStatus
	[CollectionName.ExternalMessageQueue]: ExternalMessageQueueObj
	[CollectionName.IngestDataCache]: IngestDataCacheObj
	[CollectionName.PartInstances]: DBPartInstance
	[CollectionName.PackageContainerStatuses]: PackageContainerStatusDB
	[CollectionName.PackageInfos]: PackageInfoDB
	[CollectionName.Parts]: DBPart
	[CollectionName.PeripheralDevices]: PeripheralDevice
	[CollectionName.PieceInstances]: PieceInstance
	[CollectionName.Pieces]: Piece
	[CollectionName.RundownBaselineAdLibActions]: RundownBaselineAdLibAction
	[CollectionName.RundownBaselineAdLibPieces]: RundownBaselineAdLibItem
	[CollectionName.RundownPlaylists]: DBRundownPlaylist
	[CollectionName.Rundowns]: DBRundown
	[CollectionName.Segments]: DBSegment
	[CollectionName.ShowStyleBases]: DBShowStyleBase
	[CollectionName.ShowStyleVariants]: DBShowStyleVariant
	[CollectionName.Studios]: DBStudio
	[CollectionName.Timelines]: TimelineComplete
	[CollectionName.TimelineDatastore]: DBTimelineDatastoreEntry
}
