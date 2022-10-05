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

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	settings: IStudioSettings

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
