import { PeripheralDeviceForDevice } from '../core/model/peripheralDevice'
import { RoutedMappings, RoutedTimeline } from '../core/model/Timeline'
import { DBTimelineDatastoreEntry } from '../core/model/TimelineDatastore'
import {
	PackageManagerPlayoutContext,
	PackageManagerPackageContainers,
	PackageManagerExpectedPackage,
} from '../package-manager/publications'
import { PeripheralDeviceId, RundownId, RundownPlaylistId } from '../core/model/Ids'
import { PeripheralDeviceCommand } from '../core/model/PeripheralDeviceCommand'
import { ExpectedPlayoutItemPeripheralDevice } from '../expectedPlayoutItem'
import { DeviceTriggerMountedAction, PreviewWrappedAdLib } from '../input-gateway/deviceTriggerPreviews'

/**
 * Ids of possible DDP subscriptions for any PeripheralDevice.
 */
export enum PeripheralDevicePubSub {
	peripheralDeviceCommands = 'peripheralDeviceCommands',

	// For a PeripheralDevice
	rundownsForDevice = 'rundownsForDevice',

	// custom publications:
	peripheralDeviceForDevice = 'peripheralDeviceForDevice',
	mappingsForDevice = 'mappingsForDevice',
	timelineForDevice = 'timelineForDevice',
	timelineDatastoreForDevice = 'timelineDatastoreForDevice',
	expectedPlayoutItemsForDevice = 'expectedPlayoutItemsForDevice',

	mountedTriggersForDevice = 'mountedTriggersForDevice',
	mountedTriggersForDevicePreview = 'mountedTriggersForDevicePreview',

	packageManagerPlayoutContext = 'packageManagerPlayoutContext',
	packageManagerPackageContainers = 'packageManagerPackageContainers',
	packageManagerExpectedPackages = 'packageManagerExpectedPackages',
}

/**
 * Type definitions for DDP subscriptions to be used by any PeripheralDevice.
 */
export interface PeripheralDevicePubSubTypes {
	[PeripheralDevicePubSub.peripheralDeviceCommands]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands

	// For a PeripheralDevice
	[PeripheralDevicePubSub.rundownsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.rundowns

	// custom publications:
	[PeripheralDevicePubSub.peripheralDeviceForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
	[PeripheralDevicePubSub.mappingsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioMappings
	[PeripheralDevicePubSub.timelineForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.studioTimeline
	[PeripheralDevicePubSub.timelineDatastoreForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.timelineDatastore
	[PeripheralDevicePubSub.expectedPlayoutItemsForDevice]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems

	[PeripheralDevicePubSub.mountedTriggersForDevice]: (
		deviceId: PeripheralDeviceId,
		deviceIds: string[],
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.mountedTriggers
	[PeripheralDevicePubSub.mountedTriggersForDevicePreview]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews

	/** Custom publications for package-manager */
	[PeripheralDevicePubSub.packageManagerPlayoutContext]: (
		deviceId: PeripheralDeviceId,
		token: string | undefined
	) => PeripheralDevicePubSubCollectionsNames.packageManagerPlayoutContext
	[PeripheralDevicePubSub.packageManagerPackageContainers]: (
		deviceId: PeripheralDeviceId,
		token: string | undefined
	) => PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers
	[PeripheralDevicePubSub.packageManagerExpectedPackages]: (
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token: string | undefined
	) => PeripheralDevicePubSubCollectionsNames.packageManagerExpectedPackages
}

export enum PeripheralDevicePubSubCollectionsNames {
	// Real Mongodb collections:
	peripheralDeviceCommands = 'peripheralDeviceCommands',
	rundowns = 'rundowns',
	expectedPlayoutItems = 'expectedPlayoutItems',
	timelineDatastore = 'timelineDatastore',

	// Custom collections:
	peripheralDeviceForDevice = 'peripheralDeviceForDevice',
	studioMappings = 'studioMappings',
	studioTimeline = 'studioTimeline',

	mountedTriggersPreviews = 'mountedTriggersPreviews',
	mountedTriggers = 'mountedTriggers',

	packageManagerPlayoutContext = 'packageManagerPlayoutContext',
	packageManagerPackageContainers = 'packageManagerPackageContainers',
	packageManagerExpectedPackages = 'packageManagerExpectedPackages',
}

export type PeripheralDevicePubSubCollections = {
	// Real Mongodb collections:
	[PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands]: PeripheralDeviceCommand
	[PeripheralDevicePubSubCollectionsNames.rundowns]: { _id: RundownId; playlistId: RundownPlaylistId }
	[PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems]: ExpectedPlayoutItemPeripheralDevice
	[PeripheralDevicePubSubCollectionsNames.timelineDatastore]: DBTimelineDatastoreEntry

	// Custom collections:
	[PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice]: PeripheralDeviceForDevice
	[PeripheralDevicePubSubCollectionsNames.studioMappings]: RoutedMappings
	[PeripheralDevicePubSubCollectionsNames.studioTimeline]: RoutedTimeline

	[PeripheralDevicePubSubCollectionsNames.mountedTriggersPreviews]: PreviewWrappedAdLib
	[PeripheralDevicePubSubCollectionsNames.mountedTriggers]: DeviceTriggerMountedAction

	[PeripheralDevicePubSubCollectionsNames.packageManagerPlayoutContext]: PackageManagerPlayoutContext
	[PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers]: PackageManagerPackageContainers
	[PeripheralDevicePubSubCollectionsNames.packageManagerExpectedPackages]: PackageManagerExpectedPackage
}
