import type {
	IBlueprintConfig,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/blueprints-integration'
import type { DBStudio, IStudioSettings, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { omit } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

/**
 * A lightly processed version of DBStudio, with any ObjectWithOverrides<T> pre-flattened
 */
export interface JobStudio
	extends Omit<
		DBStudio,
		| 'mappingsWithOverrides'
		| 'blueprintConfigWithOverrides'
		| 'settingsWithOverrides'
		| 'routeSetsWithOverrides'
		| 'routeSetExclusivityGroupsWithOverrides'
		| 'packageContainersWithOverrides'
	> {
	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig

	settings: IStudioSettings

	routeSets: Record<string, StudioRouteSet>
	routeSetExclusivityGroups: Record<string, StudioRouteSetExclusivityGroup>

	// /** Contains settings for which Package Containers are present in the studio.
	//  * (These are used by the Package Manager and the Expected Packages)
	//  */
	// packageContainers: Record<string, StudioPackageContainer>
}

export function convertStudioToJobStudio(studio: DBStudio): JobStudio {
	return {
		...omit(
			studio,
			'mappingsWithOverrides',
			'blueprintConfigWithOverrides',
			'settingsWithOverrides',
			'routeSetsWithOverrides',
			'routeSetExclusivityGroupsWithOverrides',
			'packageContainersWithOverrides'
		),
		mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
		blueprintConfig: applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj,
		settings: applyAndValidateOverrides(studio.settingsWithOverrides).obj,
		routeSets: applyAndValidateOverrides(studio.routeSetsWithOverrides).obj,
		routeSetExclusivityGroups: applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj,
		// packageContainers: applyAndValidateOverrides(studio.packageContainersWithOverrides).obj,
	}
}
