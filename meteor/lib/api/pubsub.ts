import {
	BucketId,
	OrganizationId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
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
import { DBUser } from '../collections/Users'
import { UIBucketContentStatus, UIPieceContentStatus, UISegmentPartNote } from './rundownNotifications'
import { UIShowStyleBase } from './showStyles'
import { UIStudio } from './studios'
import { UIDeviceTriggerPreview } from '../../server/publications/deviceTriggersPreview'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { logger } from '../logging'
import { UIBlueprintUpgradeStatus } from './upgradeStatus'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubTypes,
	PeripheralDevicePubSubCollections,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { CorelibPubSub, CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

/**
 * Ids of possible DDP subscriptions
 */
export enum MeteorPubSub {
	coreSystem = 'coreSystem',
	evaluations = 'evaluations',
	expectedPlayoutItems = 'expectedPlayoutItems',

	triggeredActions = 'triggeredActions',
	snapshots = 'snapshots',
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
	translationsBundles = 'translationsBundles',

	// custom publications:
	mappingsForStudio = 'mappingsForStudio',
	timelineForStudio = 'timelineForStudio',

	uiShowStyleBase = 'uiShowStyleBase',
	uiStudio = 'uiStudio',
	uiTriggeredActions = 'uiTriggeredActions',

	deviceTriggersPreview = 'deviceTriggersPreview',

	uiSegmentPartNotes = 'uiSegmentPartNotes',
	uiPieceContentStatuses = 'uiPieceContentStatuses',
	uiBucketContentStatuses = 'uiBucketContentStatuses',
	uiBlueprintUpgradeStatuses = 'uiBlueprintUpgradeStatuses',
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
	[MeteorPubSub.evaluations]: (selector: MongoQuery<Evaluation>, token?: string) => CollectionName.Evaluations
	[MeteorPubSub.expectedPlayoutItems]: (
		selector: MongoQuery<ExpectedPlayoutItem>,
		token?: string
	) => CollectionName.ExpectedPlayoutItems

	[MeteorPubSub.triggeredActions]: (
		selector: MongoQuery<DBTriggeredActions>,
		token?: string
	) => CollectionName.TriggeredActions
	[MeteorPubSub.snapshots]: (selector: MongoQuery<SnapshotItem>, token?: string) => CollectionName.Snapshots
	[MeteorPubSub.userActionsLog]: (
		selector: MongoQuery<UserActionsLogItem>,
		token?: string
	) => CollectionName.UserActionsLog
	/** @deprecated */
	[MeteorPubSub.mediaWorkFlows]: (
		selector: MongoQuery<MediaWorkFlow>,
		token?: string
	) => CollectionName.MediaWorkFlows
	/** @deprecated */
	[MeteorPubSub.mediaWorkFlowSteps]: (
		selector: MongoQuery<MediaWorkFlowStep>,
		token?: string
	) => CollectionName.MediaWorkFlowSteps
	[MeteorPubSub.rundownLayouts]: (
		selector: MongoQuery<RundownLayoutBase>,
		token?: string
	) => CollectionName.RundownLayouts
	[MeteorPubSub.loggedInUser]: (token?: string) => CollectionName.Users
	[MeteorPubSub.usersInOrganization]: (selector: MongoQuery<DBUser>, token?: string) => CollectionName.Users
	[MeteorPubSub.organization]: (organizationId: OrganizationId | null, token?: string) => CollectionName.Organizations
	[MeteorPubSub.buckets]: (studioId: StudioId, bucketId: BucketId | null, token?: string) => CollectionName.Buckets
	[MeteorPubSub.translationsBundles]: (
		selector: MongoQuery<TranslationsBundle>,
		token?: string
	) => CollectionName.TranslationsBundles

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
	[CollectionName.Users]: DBUser
	[CollectionName.ExpectedPlayoutItems]: ExpectedPlayoutItem

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
}

/**
 * Type safe wrapper around Meteor.subscribe()
 * @param name name of the subscription
 * @param args arguments to the subscription
 * @returns Meteor subscription handle
 */
export function meteorSubscribe<K extends keyof AllPubSubTypes>(
	name: K,
	...args: Parameters<AllPubSubTypes[K]>
): Meteor.SubscriptionHandle {
	if (Meteor.isClient) {
		const callbacks = {
			onError: (...errs: any[]) => {
				logger.error('meteorSubscribe', name, ...args, ...errs)
			},
		}

		return Meteor.subscribe(name, ...args, callbacks)
	} else throw new Meteor.Error(500, 'meteorSubscribe is only available client-side')
}
