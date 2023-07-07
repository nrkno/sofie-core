import { IBlueprintConfig, IConfigMessage } from '@sofie-automation/blueprints-integration'

export type ResultCallback<T> = (err: any, res: T) => void

export interface ServerToClientEvents {
	noArg: () => void
	// basicEmit: (a: number, b: string, c: Buffer) => void
	// withAck: (d: string, callback: (e: number) => void) => void
}

export interface ClientToServerEvents {
	// hello: () => void
	studio_validateConfig: (functionId: string, identifier: string, config: IBlueprintConfig) => IConfigMessage[]
}
