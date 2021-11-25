import { BlueprintMapping, IBlueprintConfig, PackageContainer, TSR } from '@sofie-automation/blueprints-integration'
import { ProtectedString, ProtectedStringProperties } from '../protectedString'
import { StudioId, OrganizationId, BlueprintId, ShowStyleBaseId } from './Ids'

export interface MappingsExt {
	[layerName: string]: MappingExt
}
export type MappingExt = ProtectedStringProperties<BlueprintMapping, 'deviceId'>

export interface IStudioSettings {
	/** The framerate (frames per second) used to convert internal timing information (in milliseconds)
	 * into timecodes and timecode-like strings and interpret timecode user input
	 * Default: 25
	 */
	frameRate: number

	/** URL to endpoint where media preview are exposed */
	mediaPreviewsUrl: string // (former media_previews_url in config)
	/** URL to Sofie Core endpoint */
	sofieUrl: string // (former sofie_url in config)
	/** URLs for slack webhook to send evaluations */
	slackEvaluationUrls?: string // (former slack_evaluation in config)

	/** Media Resolutions supported by the studio for media playback */
	supportedMediaFormats?: string // (former mediaResolutions in config)
	/** Audio Stream Formats supported by the studio for media playback */
	supportedAudioStreams?: string // (former audioStreams in config)

	/** Should the play from anywhere feature be enabled in this studio */
	enablePlayFromAnywhere?: boolean

	/** If set, forces the "now"-time to be set right away (aka the "multi-playout-gateway" feature).
	 * even for single playout-gateways */
	forceSettingNowTime?: boolean

	/** How much extra delay to add to the Now-time (used for the "multi-playout-gateway" feature) .
	 * A higher value adds delays in playout, but reduces the risk of missed frames. */
	nowSafeLatency?: number

	/** Preserve unsynced segment contents when the playing segment is removed, rather than removing all but the playing part */
	preserveUnsyncedPlayingSegmentContents?: boolean
	/** Allow resets while a rundown is on-air */
	allowRundownResetOnAir?: boolean
}
export type MappingsHash = ProtectedString<'MappingsHash'>

export type StudioLight = Omit<DBStudio, 'mappings' | 'blueprintConfig'>

/** A set of available layer groups in a given installation */
export interface DBStudio {
	_id: StudioId
	/** If set, this studio is owned by that organization */
	organizationId: OrganizationId | null

	/** User-presentable name for the studio installation */
	name: string
	/** Id of the blueprint used by this studio-installation */
	blueprintId?: BlueprintId

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/**
	 * A hash that is to be changed whenever there is a change to the mappings or routeSets
	 * The reason for this to exist is to be able to sync the timeline to what set of mappings it was created (routed) from.
	 */
	mappingsHash?: MappingsHash

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<ShowStyleBaseId>

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig

	settings: IStudioSettings

	_rundownVersionHash: string

	routeSets: Record<string, StudioRouteSet>
	routeSetExclusivityGroups: Record<string, StudioRouteSetExclusivityGroup>

	/** Contains settings for which Package Containers are present in the studio.
	 * (These are used by the Package Manager and the Expected Packages)
	 */
	packageContainers: Record<string, StudioPackageContainer>
	/** Which package containers is used for media previews in GUI */
	previewContainerIds: string[]
	thumbnailContainerIds: string[]
}
export interface StudioPackageContainer {
	/** List of which peripheraldevices uses this packageContainer */
	deviceIds: string[]
	container: PackageContainer
}
export interface StudioRouteSetExclusivityGroup {
	name: string
}

export interface StudioRouteSet {
	/** User-presentable name */
	name: string
	/** Whether this group is active or not */
	active: boolean
	/** Default state of this group */
	defaultActive?: boolean
	/** Only one Route can be active at the same time in the exclusivity-group */
	exclusivityGroup?: string
	/** If true, should be displayed and toggleable by user */
	behavior: StudioRouteBehavior

	routes: RouteMapping[]
}
export enum StudioRouteBehavior {
	HIDDEN = 0,
	TOGGLE = 1,
	ACTIVATE_ONLY = 2,
}
export interface RouteMapping extends ResultingMappingRoute {
	/** Which original layer to route. If false, a "new" layer will be inserted during routing */
	mappedLayer: string | undefined
}
export interface ResultingMappingRoutes {
	/** Routes that route existing layers */
	existing: {
		[mappedLayer: string]: ResultingMappingRoute[]
	}
	/** Routes that create new layers, from nothing */
	inserted: ResultingMappingRoute[]
}
export interface ResultingMappingRoute {
	outputMappedLayer: string
	deviceType?: TSR.DeviceType
	remapping?: Partial<MappingExt>
}
