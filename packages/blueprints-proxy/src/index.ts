import {
	BlueprintConfigCoreConfig,
	BlueprintResultApplyStudioConfig,
	BlueprintResultStudioBaseline,
	IBlueprintConfig,
	IConfigMessage,
} from '@sofie-automation/blueprints-integration'

export type ResultCallback<T> = (err: any, res: T) => void

export interface ServerToClientEvents {
	noArg: () => void
	// basicEmit: (a: number, b: string, c: Buffer) => void
	// withAck: (d: string, callback: (e: number) => void) => void
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
