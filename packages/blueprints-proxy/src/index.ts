import type {
	BlueprintConfigCoreConfig,
	BlueprintMappings,
	BlueprintResultApplyStudioConfig,
	BlueprintResultStudioBaseline,
	IBlueprintConfig,
	IConfigMessage,
	PackageInfo,
} from '@sofie-automation/blueprints-integration'

export type ResultCallback<T> = (err: any, res: T) => void

export interface ServerToClientEvents {
	packageInfo_getPackageInfo: (msg: PackageInfoGetPackageInfoArgs) => Readonly<PackageInfo.Any[]>
	packageInfo_hackGetMediaObjectDuration: (msg: PackageInfoHackGetMediaObjectDuration) => number | undefined
	studio_getStudioMappings: () => Readonly<BlueprintMappings>
}

export interface PackageInfoGetPackageInfoArgs {
	packageId: string
}
export interface PackageInfoHackGetMediaObjectDuration {
	mediaId: string
}

export interface ClientToServerEvents {
	studio_getBaseline: (msg: StudioGetBaselineArgs) => BlueprintResultStudioBaseline
	studio_validateConfig: (msg: StudioValidateConfigArgs) => IConfigMessage[]
	studio_applyConfig: (msg: StudioApplyConfigArgs) => BlueprintResultApplyStudioConfig
}

export interface StudioGetBaselineArgs {
	identifier: string
	studioId: string
	studioConfig: IBlueprintConfig
}

export interface StudioValidateConfigArgs {
	identifier: string
	config: IBlueprintConfig
}

export interface StudioApplyConfigArgs {
	identifier: string
	config: IBlueprintConfig
	coreConfig: BlueprintConfigCoreConfig
}
