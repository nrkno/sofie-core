import type {
	BlueprintConfigCoreConfig,
	BlueprintMappings,
	BlueprintResultApplyStudioConfig,
	BlueprintResultRundownPlaylist,
	BlueprintResultStudioBaseline,
	ExtendedIngestRundown,
	IBlueprintConfig,
	IBlueprintRundownDB,
	IBlueprintShowStyleBase,
	IConfigMessage,
	PackageInfo,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'

export type ResultCallback<T> = (err: any, res: T) => void

export type EmptyArgs = Record<string, never>

export interface BlueprintToSofieMethods {
	common_notifyUserError: (msg: NotifyUserArgs) => never
	common_notifyUserWarning: (msg: NotifyUserArgs) => never
	common_notifyUserInfo: (msg: NotifyUserArgs) => never

	packageInfo_getPackageInfo: (msg: PackageInfoGetPackageInfoArgs) => Readonly<PackageInfo.Any[]>
	packageInfo_hackGetMediaObjectDuration: (msg: PackageInfoHackGetMediaObjectDurationArgs) => number | undefined
	studio_getStudioMappings: (msg: EmptyArgs) => Readonly<BlueprintMappings>
}

export interface NotifyUserArgs {
	message: string
	params: { [key: string]: any } | undefined
}
export interface PackageInfoGetPackageInfoArgs {
	packageId: string
}
export interface PackageInfoHackGetMediaObjectDurationArgs {
	mediaId: string
}

export interface SofieToBlueprintMethods {
	studio_getBaseline: (msg: StudioGetBaselineArgs) => BlueprintResultStudioBaseline
	studio_getShowStyleId: (msg: StudioGetShowStyleIdArgs) => string | null
	studio_getRundownPlaylistInfo: (msg: StudioGetRundownPlaylistInfo) => BlueprintResultRundownPlaylist | null
	studio_validateConfig: (msg: StudioValidateConfigArgs) => IConfigMessage[]
	studio_applyConfig: (msg: StudioApplyConfigArgs) => BlueprintResultApplyStudioConfig
	studio_preprocessConfig: (msg: StudioPreprocessConfigArgs) => unknown
}

export interface StudioContextArgs {
	identifier: string
	studioId: string
	studioConfig: IBlueprintConfig
}
export type StudioGetBaselineArgs = StudioContextArgs
export interface StudioGetShowStyleIdArgs extends StudioContextArgs {
	showStyles: ReadonlyDeep<Array<IBlueprintShowStyleBase>>
	ingestRundown: ExtendedIngestRundown
}
export interface StudioGetRundownPlaylistInfo extends StudioContextArgs {
	rundowns: IBlueprintRundownDB[]
	playlistExternalId: string
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
export interface StudioPreprocessConfigArgs {
	identifier: string
	config: IBlueprintConfig
	coreConfig: BlueprintConfigCoreConfig
}
