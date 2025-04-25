import {
	BucketId,
	OrganizationId,
	PartId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Bucket } from '../collections/Buckets'
import { ICoreSystem } from '../collections/CoreSystem'
import { Evaluation } from '../collections/Evaluations'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { DBOrganization } from '../collections/Organization'
import { RundownLayoutBase } from '../collections/RundownLayouts'
import { SnapshotItem } from '../collections/Snapshots'
import { TranslationsBundle } from '../collections/TranslationsBundles'
import { DBTriggeredActions, UITriggeredActionsObj } from '../collections/TriggeredActions'
import { UserActionsLogItem } from '../collections/UserActionsLog'
import { UIBucketContentStatus, UIPieceContentStatus, UISegmentPartNote } from './rundownNotifications'
import { UIShowStyleBase } from './showStyles'
import { UIStudio } from './studios'
import { UIDeviceTriggerPreview } from './MountedTriggers'
import { UIBlueprintUpgradeStatus } from './upgradeStatus'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubTypes,
	PeripheralDevicePubSubCollections,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { CorelibPubSub, CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance } from '../collections/PartInstances'
import type { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'

/**
 * Ids of possible DDP subscriptions for the UI only
 */
export enum MeteorPubSub {
	/**
	 * Fetch the CoreSystem document
	 */
	coreSystem = 'coreSystem',
	/**
	 * Fetch all User Evaluations for the specified time range
	 */
	evaluations = 'evaluations',

	/**
	 * Fetch RundownPlaylists for the specified Studio, limited to either active or inactive playlists
	 */
	rundownPlaylistForStudio = 'rundownPlaylistForStudio',
	/**
	 * Fetch all the AdlibActions for specified PartId, limited to the specified sourceLayerIds
	 */
	adLibActionsForPart = 'adLibActionsForPart',
	/**
	 * Fetch all the AdlibPieces for specified PartId, limited to the specified sourceLayerIds
	 */
	adLibPiecesForPart = 'adLibPiecesForPart',

	/**
	 * Fetch either all TriggeredActions or limited to the specified ShowStyleBases
	 */
	triggeredActions = 'triggeredActions',
	/**
	 * Fetch all the Snapshots in the system
	 */
	snapshots = 'snapshots',
	/**
	 * Fetch all User Action Log entries for the specified time range
	 */
	userActionsLog = 'userActionsLog',
	/**
	 * Fetch all MediaManager workflows in the system
	 * @deprecated
	 */
	mediaWorkFlows = 'mediaWorkFlows',
	/**
	 * Fetch all MediaManager workflow steps in the system
	 * @deprecated
	 */
	mediaWorkFlowSteps = 'mediaWorkFlowSteps',
	/**
	 * Fetch either all RundownLayouts or limited to the specified ShowStyleBases
	 */
	rundownLayouts = 'rundownLayouts',
	/**
	 * Fetch information about a specified organization.
	 * If null is provided, nothing will be returned
	 */
	organization = 'organization',
	/**
	 * Fetch either all buckets for the given Studio, or the Bucket specified.
	 */
	buckets = 'buckets',
	/**
	 * Fetch all translation bundles
	 */
	translationsBundles = 'translationsBundles',
	/**
	 * Fetch notifications for playlist
	 */
	notificationsForRundownPlaylist = 'notificationsForRundownPlaylist',
	/**
	 * Fetch notifications for rundown
	 */
	notificationsForRundown = 'notificationsForRundown',

	// custom publications:

	/**
	 * Fetch the simplified timeline mappings for a given studio
	 */
	mappingsForStudio = 'mappingsForStudio',
	/**
	 * Fetch the simplified timeline for a given studio
	 */
	timelineForStudio = 'timelineForStudio',

	/**
	 * Fetch the simplified playout UI view of the specified ShowStyleBase
	 */
	uiShowStyleBase = 'uiShowStyleBase',
	/**
	 * Fetch the simplified playout UI view of the specified Studio.
	 * If the id is null, all studios will be returned
	 */
	uiStudio = 'uiStudio',
	/**
	 * Fetch the simplified playout UI view of the TriggeredActions in the specified ShowStyleBase.
	 * If the id is null, only global TriggeredActions will be returned
	 */
	uiTriggeredActions = 'uiTriggeredActions',

	/**
	 * Fetch the calculated trigger previews for the given Studio
	 */
	deviceTriggersPreview = 'deviceTriggersPreview',

	/**
	 * Fetch the Segment and Part notes in the given RundownPlaylist
	 * If the id is null, nothing will be returned
	 */
	uiSegmentPartNotes = 'uiSegmentPartNotes',
	/**
	 * Fetch the Pieces content-status in the given RundownPlaylist
	 * If the id is null, nothing will be returned
	 */
	uiPieceContentStatuses = 'uiPieceContentStatuses',
	/**
	 * Fetch the Pieces content-status in the given Bucket
	 */
	uiBucketContentStatuses = 'uiBucketContentStatuses',
	/**
	 * Fetch the Upgrade Statuses of all Blueprints in the system
	 */
	uiBlueprintUpgradeStatuses = 'uiBlueprintUpgradeStatuses',
	/**
	 * Fetch all Parts with UI overrides
	 */
	uiParts = 'uiParts',
	/**
	 * Fetch all PartInstances with UI overrides
	 */
	uiPartInstances = 'uiPartInstances',
}

/**
 * Names of all the known DDP publications
 */
export const AllPubSubNames: string[] = [
	...Object.values<string>(MeteorPubSub),
	...Object.values<string>(CorelibPubSub),
	...Object.values<string>(PeripheralDevicePubSub),
]

/**
 * Type definitions for all DDP subscriptions.
 * All the PubSub ids must be present here, or they will produce type errors when used
 */
export type AllPubSubTypes = CorelibPubSubTypes & PeripheralDevicePubSubTypes & MeteorPubSubTypes

export interface MeteorPubSubTypes {
	[MeteorPubSub.coreSystem]: (token?: string) => CollectionName.CoreSystem
	[MeteorPubSub.evaluations]: (dateFrom: number, dateTo: number, token?: string) => CollectionName.Evaluations

	[MeteorPubSub.rundownPlaylistForStudio]: (studioId: StudioId, isActive: boolean) => CollectionName.RundownPlaylists
	[MeteorPubSub.adLibActionsForPart]: (partId: PartId, sourceLayerIds: string[]) => CollectionName.AdLibActions
	[MeteorPubSub.adLibPiecesForPart]: (partId: PartId, sourceLayerIds: string[]) => CollectionName.AdLibPieces

	[MeteorPubSub.triggeredActions]: (
		/** ShowStyleBaseIds to fetch for, or null to just fetch global */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.TriggeredActions
	[MeteorPubSub.snapshots]: (token?: string) => CollectionName.Snapshots
	[MeteorPubSub.userActionsLog]: (dateFrom: number, dateTo: number, token?: string) => CollectionName.UserActionsLog
	/** @deprecated */
	[MeteorPubSub.mediaWorkFlows]: (token?: string) => CollectionName.MediaWorkFlows
	/** @deprecated */
	[MeteorPubSub.mediaWorkFlowSteps]: (token?: string) => CollectionName.MediaWorkFlowSteps
	[MeteorPubSub.rundownLayouts]: (
		/** ShowStyleBaseIds to fetch for, or null to fetch all */
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token?: string
	) => CollectionName.RundownLayouts
	[MeteorPubSub.organization]: (organizationId: OrganizationId | null, token?: string) => CollectionName.Organizations
	[MeteorPubSub.buckets]: (studioId: StudioId, bucketId: BucketId | null, token?: string) => CollectionName.Buckets
	[MeteorPubSub.translationsBundles]: (token?: string) => CollectionName.TranslationsBundles
	[MeteorPubSub.notificationsForRundown]: (studioId: StudioId, rundownId: RundownId) => CollectionName.Notifications
	[MeteorPubSub.notificationsForRundownPlaylist]: (
		studioId: StudioId,
		playlistId: RundownPlaylistId
	) => CollectionName.Notifications

	// custom publications:

	[MeteorPubSub.mappingsForStudio]: (
		studioId: StudioId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioMappings
	[MeteorPubSub.timelineForStudio]: (
		studioId: StudioId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioTimeline
	[MeteorPubSub.uiShowStyleBase]: (showStyleBaseId: ShowStyleBaseId) => CustomCollectionName.UIShowStyleBase
	/** Subscribe to one or all studios */
	[MeteorPubSub.uiStudio]: (studioId: StudioId | null) => CustomCollectionName.UIStudio
	[MeteorPubSub.uiTriggeredActions]: (
		showStyleBaseId: ShowStyleBaseId | null
	) => CustomCollectionName.UITriggeredActions

	[MeteorPubSub.deviceTriggersPreview]: (
		studioId: StudioId,
		token?: string
	) => CustomCollectionName.UIDeviceTriggerPreviews

	/** Custom publications for the UI */
	[MeteorPubSub.uiSegmentPartNotes]: (playlistId: RundownPlaylistId | null) => CustomCollectionName.UISegmentPartNotes
	[MeteorPubSub.uiPieceContentStatuses]: (
		rundownPlaylistId: RundownPlaylistId | null
	) => CustomCollectionName.UIPieceContentStatuses
	[MeteorPubSub.uiBucketContentStatuses]: (
		studioId: StudioId,
		bucketId: BucketId
	) => CustomCollectionName.UIBucketContentStatuses
	[MeteorPubSub.uiBlueprintUpgradeStatuses]: () => CustomCollectionName.UIBlueprintUpgradeStatuses
	[MeteorPubSub.uiParts]: (playlistId: RundownPlaylistId | null) => CustomCollectionName.UIParts
	[MeteorPubSub.uiPartInstances]: (
		playlistActivationId: RundownPlaylistActivationId | null
	) => CustomCollectionName.UIPartInstances
}

export type AllPubSubCollections = PeripheralDevicePubSubCollections &
	CorelibPubSubCollections &
	MeteorPubSubCollections

/**
 * Ids of possible Custom collections, populated by DDP subscriptions
 */
export enum CustomCollectionName {
	UIShowStyleBase = 'uiShowStyleBase',
	UIStudio = 'uiStudio',
	UITriggeredActions = 'uiTriggeredActions',
	UIDeviceTriggerPreviews = 'deviceTriggerPreviews',
	UISegmentPartNotes = 'uiSegmentPartNotes',
	UIPieceContentStatuses = 'uiPieceContentStatuses',
	UIBucketContentStatuses = 'uiBucketContentStatuses',
	UIBlueprintUpgradeStatuses = 'uiBlueprintUpgradeStatuses',
	UIParts = 'uiParts',
	UIPartInstances = 'uiPartInstances',
}

export type MeteorPubSubCollections = {
	[CollectionName.CoreSystem]: ICoreSystem
	[CollectionName.Evaluations]: Evaluation
	[CollectionName.TriggeredActions]: DBTriggeredActions
	[CollectionName.Snapshots]: SnapshotItem
	[CollectionName.UserActionsLog]: UserActionsLogItem
	[CollectionName.RundownLayouts]: RundownLayoutBase
	[CollectionName.Organizations]: DBOrganization
	[CollectionName.Buckets]: Bucket
	[CollectionName.TranslationsBundles]: TranslationsBundle
	[CollectionName.ExpectedPlayoutItems]: ExpectedPlayoutItem
	[CollectionName.Notifications]: DBNotificationObj

	[CollectionName.MediaWorkFlows]: MediaWorkFlow
	[CollectionName.MediaWorkFlowSteps]: MediaWorkFlowStep
} & MeteorPubSubCustomCollections

export type MeteorPubSubCustomCollections = {
	[CustomCollectionName.UIShowStyleBase]: UIShowStyleBase
	[CustomCollectionName.UIStudio]: UIStudio
	[CustomCollectionName.UITriggeredActions]: UITriggeredActionsObj
	[CustomCollectionName.UIDeviceTriggerPreviews]: UIDeviceTriggerPreview
	[CustomCollectionName.UISegmentPartNotes]: UISegmentPartNote
	[CustomCollectionName.UIPieceContentStatuses]: UIPieceContentStatus
	[CustomCollectionName.UIBucketContentStatuses]: UIBucketContentStatus
	[CustomCollectionName.UIBlueprintUpgradeStatuses]: UIBlueprintUpgradeStatus
	[CustomCollectionName.UIParts]: DBPart
	[CustomCollectionName.UIPartInstances]: PartInstance
}
