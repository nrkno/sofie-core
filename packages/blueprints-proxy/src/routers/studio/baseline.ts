import {
	BlueprintMappings,
	BlueprintResultStudioBaseline,
	IStudioBaselineContext,
	PackageInfo,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { StudioGetBaselineArgs } from '@sofie-automation/shared-lib'
import { CommonContext } from '../../context/common'
import { callHelper, MySocket } from '../util'

class StudioBaselineContext extends CommonContext implements IStudioBaselineContext {
	readonly #data: StudioGetBaselineArgs
	readonly #socket: MySocket
	readonly #functionId: string

	public get studioId(): string {
		return this.#data.studioId
	}

	constructor(msg: StudioGetBaselineArgs, socket: MySocket, functionId: string) {
		super(`getBaseline ${msg.identifier}`)

		this.#data = msg
		this.#socket = socket
		this.#functionId = functionId
	}

	getStudioConfig(): unknown {
		return this.#data.studioConfig
	}
	getStudioConfigRef(configKey: string): string {
		// TODO - we should avoid duplicating this logic
		return '${studio.' + this.#data.studioId + '.' + configKey + '}'
	}
	async getStudioMappings(): Promise<Readonly<BlueprintMappings>> {
		return callHelper(this.#socket, this.#functionId, 'studio_getStudioMappings', {})
	}
	async getPackageInfo(packageId: string): Promise<readonly PackageInfo.Any[]> {
		return callHelper(this.#socket, this.#functionId, 'packageInfo_getPackageInfo', { packageId })
	}
	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return callHelper(this.#socket, this.#functionId, 'packageInfo_hackGetMediaObjectDuration', { mediaId })
	}
}

export async function studio_getBaseline(
	studioBlueprint: StudioBlueprintManifest,
	socket: MySocket,
	id: string,
	msg: StudioGetBaselineArgs
): Promise<BlueprintResultStudioBaseline> {
	const context = new StudioBaselineContext(msg, socket, id)

	const result = await studioBlueprint.getBaseline(context)

	// TODO - cleanup?

	return result
}
