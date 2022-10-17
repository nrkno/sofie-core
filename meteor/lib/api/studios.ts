import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IStudioSettings,
	MappingsExt,
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
 * A minimal version of DBStudio, intended for the playout portions of the UI.
 * Note: The settings ui uses the raw types
 * This intentionally does not extend Studio, so that we have fine-grained control over the properties exposed
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
