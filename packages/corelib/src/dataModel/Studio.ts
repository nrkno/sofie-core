import { IBlueprintConfig, TSR } from '@sofie-automation/blueprints-integration'
import { ObjectWithOverrides } from '../settings/objectWithOverrides'
import { StudioId, OrganizationId, BlueprintId, ShowStyleBaseId, MappingsHash, PeripheralDeviceId } from './Ids'
import { BlueprintHash, LastBlueprintConfig } from './Blueprint'
import { MappingsExt, MappingExt } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { ForceQuickLoopAutoNext } from './RundownPlaylist'
import {
	ResultingMappingRoute,
	RouteMapping,
	StudioRouteBehavior,
	ResultingMappingRoutes,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	StudioAbPlayerDisabling,
} from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'
import { StudioPackageContainer } from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'

export { MappingsExt, MappingExt, MappingsHash }

// RouteSet functions has been moved to shared-lib:
// So we need to re-export them here:
export {
	StudioRouteSetExclusivityGroup,
	ResultingMappingRoute,
	RouteMapping,
	StudioRouteBehavior,
	ResultingMappingRoutes,
	StudioRouteSet,
	StudioRouteType,
	StudioAbPlayerDisabling,
	StudioPackageContainer,
}

export interface IStudioSettings {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number

	/** URL to endpoint where media preview are exposed */
	mediaPreviewsUrl: string // (former media_previews_url in config)
	/** URLs for slack webhook to send evaluations */
	slackEvaluationUrls?: string // (former slack_evaluation in config)

	/** Media Resolutions supported by the studio for media playback */
	supportedMediaFormats?: string // (former mediaResolutions in config)
	/** Audio Stream Formats supported by the studio for media playback */
	supportedAudioStreams?: string // (former audioStreams in config)

	/** Should the play from anywhere feature be enabled in this studio */
	enablePlayFromAnywhere?: boolean

	/**
	 * If set, forces the multi-playout-gateway mode (aka set "now"-time right away)
	 * for single playout-gateways setups
	 */
	forceMultiGatewayMode?: boolean

	/** How much extra delay to add to the Now-time (used for the "multi-playout-gateway" feature) .
	 * A higher value adds delays in playout, but reduces the risk of missed frames. */
	multiGatewayNowSafeLatency?: number

	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir?: boolean

	/** Preserve unsynced segments psoition in the rundown, relative to the other segments */
	preserveOrphanedSegmentPositionInRundown?: boolean

	/**
	 * The minimum amount of time, in milliseconds, that must pass after a take before another take may be performed.
	 * Default: 1000
	 */
	minimumTakeSpan: number

	/** Whether to allow adlib testing mode, before a Part is playing in a Playlist */
	allowAdlibTestingSegment?: boolean

	/** Should QuickLoop context menu options be available to the users. It does not affect Playlist loop enabled by the NRCS. */
	enableQuickLoop?: boolean

	/** If and how to force auto-nexting in a looping Playlist */
	forceQuickLoopAutoNext?: ForceQuickLoopAutoNext

	/**
	 * The duration to apply on too short Parts Within QuickLoop when ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION is selected
	 * Default: 3000
	 */
	fallbackPartDuration?: number
}

export type StudioLight = Omit<DBStudio, 'mappingsWithOverrides' | 'blueprintConfigWithOverrides'>

/** A set of available layer groups in a given installation */
export interface DBStudio {
	_id: StudioId
	/** If set, this studio is owned by that organization */
	organizationId: OrganizationId | null

	/** User-presentable name for the studio installation */
	name: string
	/** Id of the blueprint used by this studio-installation */
	blueprintId?: BlueprintId
	/** Id of the blueprint config preset */
	blueprintConfigPresetId?: string
	/** Whether blueprintConfigPresetId is invalid, and does not match a currently exposed preset from the Blueprint */
	blueprintConfigPresetIdUnlinked?: boolean

	/** Mappings between the physical devices / outputs and logical ones */
	mappingsWithOverrides: ObjectWithOverrides<MappingsExt>

	/**
	 * A hash that is to be changed whenever there is a change to the mappings or routeSets
	 * The reason for this to exist is to be able to sync the timeline to what set of mappings it was created (routed) from.
	 */
	mappingsHash?: MappingsHash

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<ShowStyleBaseId>

	/** Config values are used by the Blueprints */
	blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	settings: IStudioSettings

	_rundownVersionHash: string

	routeSetsWithOverrides: ObjectWithOverrides<Record<string, StudioRouteSet>>
	routeSetExclusivityGroupsWithOverrides: ObjectWithOverrides<Record<string, StudioRouteSetExclusivityGroup>>

	/** Contains settings for which Package Containers are present in the studio.
	 * (These are used by the Package Manager and the Expected Packages)
	 */
	packageContainersWithOverrides: ObjectWithOverrides<Record<string, StudioPackageContainer>>

	/** Which package containers is used for media previews in GUI */
	previewContainerIds: string[]
	thumbnailContainerIds: string[]

	peripheralDeviceSettings: StudioPeripheralDeviceSettings

	/** Details on the last blueprint used to generate the defaults values for this */
	lastBlueprintConfig: LastBlueprintConfig | undefined
	/** Last BlueprintHash where the fixupConfig method was run */
	lastBlueprintFixUpHash: BlueprintHash | undefined
}

export interface StudioPeripheralDeviceSettings {
	/** Playout gateway sub-devices */
	playoutDevices: ObjectWithOverrides<Record<string, StudioPlayoutDevice>>

	/** Ingest gateway sub-devices */
	ingestDevices: ObjectWithOverrides<Record<string, StudioIngestDevice>>

	/** Input gateway sub-devices */
	inputDevices: ObjectWithOverrides<Record<string, StudioInputDevice>>
}

export interface StudioIngestDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined
	/** Settings blob of the subdevice, from the sub-device config schema */
	options: unknown
}

export interface StudioInputDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined
	/** Settings blob of the subdevice, from the sub-device config schema */
	options: unknown
}

export interface StudioPlayoutDevice {
	/**
	 * The id of the gateway this is assigned to
	 * Future: This may be replaced with some other grouping or way of assigning devices
	 */
	peripheralDeviceId: PeripheralDeviceId | undefined

	options: TSR.DeviceOptionsAny
}
