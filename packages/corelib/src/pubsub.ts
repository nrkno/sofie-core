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
import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { RundownPlaylistActivationId, SegmentPlayoutId, ShowStyleVariantId } from './dataModel/Ids'

/**
 * Ids of possible DDP subscriptions for any the UI and gateways accessing the Rundown & RundownPlaylist model.
 */
export enum CorelibPubSub {
	rundownPlaylists = 'rundownPlaylists',
	rundowns = 'rundowns',
	ingestDataCache = 'ingestDataCache',

	rundownBaselineAdLibPieces = 'rundownBaselineAdLibPieces',
	rundownBaselineAdLibActions = 'rundownBaselineAdLibActions',
	adLibActions = 'adLibActions',
	adLibPieces = 'adLibPieces',

	segments = 'segments',
	parts = 'parts',
	partInstances = 'partInstances',
	partInstancesSimple = 'partInstancesSimple',
	partInstancesForSegmentPlayout = 'partInstancesForSegmentPlayout',
	pieces = 'pieces',
	pieceInstances = 'pieceInstances',
	pieceInstancesSimple = 'pieceInstancesSimple',

	timelineDatastore = 'timelineDatastore',

	expectedPackages = 'expectedPackages',
	expectedPackageWorkStatuses = 'expectedPackageWorkStatuses',
	packageContainerStatuses = 'packageContainerStatuses',

	bucketAdLibPieces = 'bucketAdLibPieces',
	bucketAdLibActions = 'bucketAdLibActions',

	externalMessageQueue = 'externalMessageQueue',

	blueprints = 'blueprints',
	showStyleBases = 'showStyleBases',
	showStyleVariants = 'showStyleVariants',
	studios = 'studios',

	peripheralDevices = 'peripheralDevices',
	peripheralDevicesAndSubDevices = 'peripheralDevicesAndSubDevices',
}

/**
 * Type definitions for DDP subscriptions for any the UI and gateways accessing the Rundown & RundownPlaylist model.
 */
export interface CorelibPubSubTypes {
	[CorelibPubSub.blueprints]: (selector: MongoQuery<Blueprint>, token?: string) => CollectionName.Blueprints

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
		selector: MongoQuery<IngestDataCacheObj>,
		token?: string
	) => CollectionName.IngestDataCache
	[CorelibPubSub.rundownPlaylists]: (
		selector: MongoQuery<DBRundownPlaylist>,
		token?: string
	) => CollectionName.RundownPlaylists
	[CorelibPubSub.rundowns]: (
		/** RundownPlaylistId to fetch for, or null to not check */
		playlistIds: RundownPlaylistId[] | null,
		/** ShowStyleBaseId to fetch for, or null to not check */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.Rundowns
	[CorelibPubSub.adLibActions]: (rundownIds: RundownId[], token?: string) => CollectionName.AdLibActions
	[CorelibPubSub.adLibPieces]: (rundownIds: RundownId[], token?: string) => CollectionName.AdLibPieces
	[CorelibPubSub.pieces]: (selector: MongoQuery<Piece>, token?: string) => CollectionName.Pieces
	[CorelibPubSub.pieceInstances]: (
		selector: MongoQuery<PieceInstance>,
		token?: string
	) => CollectionName.PieceInstances
	[CorelibPubSub.pieceInstancesSimple]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token?: string
	) => CollectionName.PieceInstances
	[CorelibPubSub.parts]: (rundownIds: RundownId[], token?: string) => CollectionName.Parts
	[CorelibPubSub.partInstances]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | undefined,
		token?: string
	) => CollectionName.PartInstances
	[CorelibPubSub.partInstancesSimple]: (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token?: string
	) => CollectionName.PartInstances
	[CorelibPubSub.partInstancesForSegmentPlayout]: (
		rundownId: RundownId,
		segmentPlayoutId: SegmentPlayoutId,
		token?: string
	) => CollectionName.PartInstances
	[CorelibPubSub.segments]: (rundownIds: RundownId[], omitHidden: boolean, token?: string) => CollectionName.Segments
	[CorelibPubSub.showStyleBases]: (
		/** ShowStyleBaseIds to fetch for, or null to fetch all */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.ShowStyleBases
	[CorelibPubSub.showStyleVariants]: (
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
		selector: MongoQuery<BucketAdLib>,
		token?: string
	) => CollectionName.BucketAdLibPieces
	[CorelibPubSub.bucketAdLibActions]: (
		selector: MongoQuery<BucketAdLibAction>,
		token?: string
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
