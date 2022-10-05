import {
	IStudioSettings,
	MappingsExt,
	StudioId,
	StudioPackageContainer,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '../collections/Studios'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',
}

/**
 * INTENDED FOR PLAYOUT YO, not for settings
 */
export interface UIStudio {
	_id: StudioId

	/** User-presentable name for the studio installation */
	name: string
	// /** Id of the blueprint used by this studio-installation */
	// blueprintId?: BlueprintId

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	// /**
	//  * A hash that is to be changed whenever there is a change to the mappings or routeSets
	//  * The reason for this to exist is to be able to sync the timeline to what set of mappings it was created (routed) from.
	//  */
	// mappingsHash?: MappingsHash

	// /** List of which ShowStyleBases this studio wants to support */
	// supportedShowStyleBase: Array<ShowStyleBaseId>

	// /** Config values are used by the Blueprints */
	// blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	settings: IStudioSettings

	// _rundownVersionHash: string

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
