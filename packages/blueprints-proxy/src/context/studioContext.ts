import { BlueprintMappings, IStudioContext } from '@sofie-automation/blueprints-integration'
import { MySocket } from '../routers/util'
import { StudioContextArgs } from '..'
import { CommonContext } from './common'

export class StudioContext extends CommonContext implements IStudioContext {
	readonly #data: StudioContextArgs

	public get studioId(): string {
		return this.#data.studioId
	}

	constructor(functionName: string, socket: MySocket, functionId: string, msg: StudioContextArgs) {
		super(`${functionName} ${msg.identifier}`, socket, functionId)

		this.#data = msg
	}

	getStudioConfig(): unknown {
		return this.#data.studioConfig
	}
	getStudioConfigRef(configKey: string): string {
		// TODO - we should avoid duplicating this logic
		return '${studio.' + this.#data.studioId + '.' + configKey + '}'
	}
	async getStudioMappings(): Promise<Readonly<BlueprintMappings>> {
		return this.emitCall('studio_getStudioMappings', {})
	}
}
