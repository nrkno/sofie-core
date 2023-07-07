import {
	BlueprintConfigCoreConfig,
	BlueprintResultApplyStudioConfig,
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
	// hello: () => void
	studio_validateConfig: (msg: StudioValidateConfigArgs) => IConfigMessage[]
	studio_applyConfig: (msg: StudioApplyConfigArgs) => BlueprintResultApplyStudioConfig
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
