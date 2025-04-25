import { DBPart } from './dataModel/Part'
import { CollectionName } from './dataModel/Collections'
import { MongoQuery } from './mongo'
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
import { NrcsIngestDataCacheObj } from './dataModel/NrcsIngestDataCache'
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
import {
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { BlueprintId, BucketId, RundownPlaylistActivationId, SegmentId, ShowStyleVariantId } from './dataModel/Ids'
import { PackageInfoDB } from './dataModel/PackageInfos'

/**
 * Ids of possible DDP subscriptions for any the UI and gateways accessing the Rundown & RundownPlaylist model.
 */
export enum CorelibPubSub {
	/**
	 * Fetch RundownPlaylists. Either all in the system, limited to certain Studios, or to specific RundownPlaylists by id.
	 */
	rundownPlaylists = 'rundownPlaylists',
	/**
	 * Fetch Rundowns belonging to specific RundownPlaylists by id.
	 */
	rundownsInPlaylists = 'rundownsInPlaylists',
	/**
	 * Fetch Rundowns belonging to certain ShowStyleBases.
	 */
	rundownsWithShowStyleBases = 'rundownsWithShowStyleBases',
	/**
	 * Fetch cached ingest data
	 */
	ingestDataCache = 'ingestDataCache',

	/**
	 * Fetch baseline adlib pieces belonging to the specified Rundowns
	 */
	rundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	/**
	 * Fetch baseline adlib actions belonging to the specified Rundowns
	 */
	rundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	/**
	 * Fetch adlib actions belonging to the specified Rundowns
	 */
	adLibActions = 'adLibActions',
	/**
	 * Fetch adlib pieces belonging to the specified Rundowns
	 */
	adLibPieces = 'adLibPieces',

	/**
	 *  Fetch Segments belonging to the specified Rundowns, optionally omitting ones set as hidden
	 */
	segments = 'segments',
	/**
	 * Fetch Parts belonging to the specified Rundowns
	 */
	parts = 'parts',
	/**
	 * Fetch PartInstances in the specified Rundowns. If set, the result will be limited to the supplied RundownPlaylistActivationId.
	 * Any reset PartInstances will be omitted
	 */
	partInstances = 'partInstances',
	/**
	 * Fetch PartInstances in the specified Rundowns. If set, the result will be limited to the supplied RundownPlaylistActivationId.
	 * Any reset PartInstances will be omitted
	 * This provides a simplified form of the PartInstance, with any timing information omitted to reduce data churn
	 */
	partInstancesSimple = 'partInstancesSimple',
	/**
	 * Fetch Pieces belonging to the specified Rundowns, optionally limiting the result to the specified Parts
	 */
	pieces = 'pieces',
	/**
	 * Fetch Pieces which are infinite and start within the specified range of Segments or Rundowns.
	 */
	piecesInfiniteStartingBefore = 'piecesInfiniteStartingBefore',
	/**
	 * Fetch PieceInstances in the specified Rundowns, optionally limiting the result to the specified PartInstances.
	 * Optionally only returning PieceInstances which are playing and were sourced from adlibs, or have tags set.
	 * Any reset PieceInstances will be omitted
	 */
	pieceInstances = 'pieceInstances',
	/**
	 * Fetch PieceInstances in the specified Rundowns. If set, the result will be limited to the supplied RundownPlaylistActivationId.
	 * Any reset PieceInstances will be omitted
	 * This provides a simplified form of the PieceInstance, with any timing information omitted to reduce data churn
	 */
	pieceInstancesSimple = 'pieceInstancesSimple',

	/**
	 * Fetch all Timeline Datastore entries in the specified Studio
	 */
	timelineDatastore = 'timelineDatastore',

	/**
	 * Fetch all Expected Packages in the specified Studios
	 */
	expectedPackages = 'expectedPackages',
	/**
	 * Fetch all Expected Package statuses in the specified Studios
	 */
	expectedPackageWorkStatuses = 'expectedPackageWorkStatuses',
	/**
	 * Fetch all Package container statuses in the specified Studios
	 */
	packageContainerStatuses = 'packageContainerStatuses',

	/**
	 * Fetch all bucket adlib pieces for the specified Studio and Bucket.
	 * The result will be limited to ones valid to the ShowStyleVariants specified, as well as ones marked as valid in any ShowStyleVariant
	 */
	bucketAdLibPieces = 'bucketAdLibPieces',
	/**
	 * Fetch all bucket adlib action for the specified Studio and Bucket.
	 * The result will be limited to ones valid to the ShowStyleVariants specified, as well as ones marked as valid in any ShowStyleVariant
	 */
	bucketAdLibActions = 'bucketAdLibActions',

	/**
	 * Fetch all the External Message Queue documents with a raw mongo query
	 */
	externalMessageQueue = 'externalMessageQueue',

	/**
	 * Fetch either all Blueprints, or the ones specified
	 */
	blueprints = 'blueprints',
	/**
	 * Fetch either all ShowStyleBases, or the ones specified
	 */
	showStyleBases = 'showStyleBases',
	/**
	 * Fetch either all ShowStyleVariants, or the ones specified
	 */
	showStyleVariants = 'showStyleVariants',
	/**
	 * Fetch either all Studios, or the ones specified
	 */
	studios = 'studios',

	/**
	 * Fetch either all PeripheralDevices, or the ones specified
	 */
	peripheralDevices = 'peripheralDevices',
	/**
	 * Fetch all the PeripheralDevices and sub-devices for the specified Studio
	 */
	peripheralDevicesAndSubDevices = 'peripheralDevicesAndSubDevices',

	/**
	 * Fetch all the PackageInfos owned by a PeripheralDevice
	 */
	packageInfos = 'packageInfos',
}

/**
 * Type definitions for DDP subscriptions for any the UI and gateways accessing the Rundown & RundownPlaylist model.
 */
export interface CorelibPubSubTypes {
	[CorelibPubSub.blueprints]: (
		/** BlueprintIds to fetch for, or null to fetch all */
		blueprintIds: BlueprintId[] | null,
		token?: string
	) => CollectionName.Blueprints

	[CorelibPubSub.externalMessageQueue]: (
		selector: MongoQuery<ExternalMessageQueueObj>,
		token?: string
	) => CollectionName.ExternalMessageQueue
	[CorelibPubSub.peripheralDevices]: (
		/** PeripheralDeviceId to fetch for, or null to fetch all */
		deviceIds: PeripheralDeviceId[] | null,
		token?: string
	) => CollectionName.PeripheralDevices
	[CorelibPubSub.peripheralDevicesAndSubDevices]: (studioId: StudioId) => CollectionName.PeripheralDevices
	[CorelibPubSub.rundownBaselineAdLibPieces]: (
		rundownIds: RundownId[],
		token?: string
	) => CollectionName.RundownBaselineAdLibPieces
	[CorelibPubSub.rundownBaselineAdLibActions]: (
		rundownIds: RundownId[],
		token?: string
	) => CollectionName.RundownBaselineAdLibActions
	[CorelibPubSub.ingestDataCache]: (
		selector: MongoQuery<NrcsIngestDataCacheObj>,
		token?: string
	) => CollectionName.NrcsIngestDataCache
	[CorelibPubSub.rundownPlaylists]: (
		/** RundownPlaylistIds to fetch for, or null to fetch all */
		rundownPlaylistIds: RundownPlaylistId[] | null,
		/** StudioIds to fetch for, or null to fetch all */
		studioIds: StudioId[] | null,
		token?: string
	) => CollectionName.RundownPlaylists
	[CorelibPubSub.rundownsInPlaylists]: (playlistIds: RundownPlaylistId[], token?: string) => CollectionName.Rundowns
	[CorelibPubSub.rundownsWithShowStyleBases]: (
		showStyleBaseIds: ShowStyleBaseId[],
		token?: string
	) => CollectionName.Rundowns
	[CorelibPubSub.adLibActions]: (rundownIds: RundownId[], token?: string) => CollectionName.AdLibActions
	[CorelibPubSub.adLibPieces]: (rundownIds: RundownId[], token?: string) => CollectionName.AdLibPieces
	[CorelibPubSub.pieces]: (
		rundownIds: RundownId[],
		/** PartIds to fetch for, or null to fetch all */
		partIds: PartId[] | null,
		token?: string
	) => CollectionName.Pieces
	[CorelibPubSub.piecesInfiniteStartingBefore]: (
		thisRundownId: RundownId,
		segmentsIdsBefore: SegmentId[],
		rundownIdsBefore: RundownId[],
		token?: string
	) => CollectionName.Pieces
	[CorelibPubSub.pieceInstances]: (
		rundownIds: RundownId[],
		/** PartInstanceIds to fetch for, or null to fetch all */
		partInstanceIds: PartInstanceId[] | null,
		filter: {
			/** Only include PieceInstances which are playing as an adlib, or with tags */
			onlyPlayingAdlibsOrWithTags?: boolean
		},
		token?: string
	) => CollectionName.PieceInstances
	[CorelibPubSub.pieceInstancesSimple]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token?: string
	) => CollectionName.PieceInstances
	[CorelibPubSub.parts]: (
		rundownIds: RundownId[],
		/** SegmentIds to fetch for, or null to fetch all */
		segmentIds: SegmentId[] | null,
		token?: string
	) => CollectionName.Parts
	[CorelibPubSub.partInstances]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token?: string
	) => CollectionName.PartInstances
	[CorelibPubSub.partInstancesSimple]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token?: string
	) => CollectionName.PartInstances
	[CorelibPubSub.segments]: (
		rundownIds: RundownId[],
		filter: {
			/** Omit any Segments marked with `isHidden` */
			omitHidden?: boolean
		},
		token?: string
	) => CollectionName.Segments
	[CorelibPubSub.showStyleBases]: (
		/** ShowStyleBaseIds to fetch for, or null to fetch all */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.ShowStyleBases
	[CorelibPubSub.showStyleVariants]: (
		/** ShowStyleBaseIds to fetch for, or null to fetch all */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		/** ShowStyleVariantId to fetch for, or null to fetch all */
		showStyleVariantIds: ShowStyleVariantId[] | null,
		token?: string
	) => CollectionName.ShowStyleVariants
	[CorelibPubSub.studios]: (
		/** StudioIds to fetch for, or null to fetch all */
		studioIds: StudioId[] | null,
		token?: string
	) => CollectionName.Studios
	[CorelibPubSub.timelineDatastore]: (studioId: StudioId, token?: string) => CollectionName.TimelineDatastore
	[CorelibPubSub.bucketAdLibPieces]: (
		studioId: StudioId,
		bucketId: BucketId,
		showStyleVariantIds: ShowStyleVariantId[]
	) => CollectionName.BucketAdLibPieces
	[CorelibPubSub.bucketAdLibActions]: (
		studioId: StudioId,
		bucketId: BucketId,
		showStyleVariantIds: ShowStyleVariantId[]
	) => CollectionName.BucketAdLibActions
	[CorelibPubSub.expectedPackages]: (studioIds: StudioId[], token?: string) => CollectionName.ExpectedPackages
	[CorelibPubSub.expectedPackageWorkStatuses]: (
		studioIds: StudioId[],
		token?: string
	) => CollectionName.ExpectedPackageWorkStatuses
	[CorelibPubSub.packageContainerStatuses]: (
		studioIds: StudioId[],
		token?: string
	) => CollectionName.PackageContainerStatuses
	[CorelibPubSub.packageInfos]: (deviceId: PeripheralDeviceId, token?: string) => CollectionName.PackageInfos
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
	[CollectionName.NrcsIngestDataCache]: NrcsIngestDataCacheObj
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
