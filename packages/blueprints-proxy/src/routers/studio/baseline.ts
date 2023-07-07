import {
	BlueprintMappings,
	BlueprintResultStudioBaseline,
	IStudioBaselineContext,
	PackageInfo,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { StudioGetBaselineArgs } from '@sofie-automation/shared-lib'
import { CommonContext } from '../../context/common'
import { MySocket } from '../util'

class StudioBaselineContext extends CommonContext implements IStudioBaselineContext {
	readonly #data: StudioGetBaselineArgs

	public get studioId(): string {
		return this.#data.studioId
	}

	constructor(msg: StudioGetBaselineArgs) {
		super(`getBaseline ${msg.identifier}`)

		this.#data = msg
	}

	getStudioConfig(): unknown {
		return this.#data.studioConfig
	}
	getStudioConfigRef(configKey: string): string {
		throw new Error('Method not implemented.')
	}
	async getStudioMappings(): Promise<Readonly<BlueprintMappings>> {
		throw new Error('not implemented')
	}
	async getPackageInfo(packageId: string): Promise<readonly PackageInfo.Any[]> {
		throw new Error('not implemented')
	}
	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		throw new Error('not implemented')
	}
}

export async function studio_getBaseline(
	studioBlueprint: StudioBlueprintManifest,
	_socket: MySocket,
	_id: string,
	msg: StudioGetBaselineArgs
): Promise<BlueprintResultStudioBaseline> {
	const context = new StudioBaselineContext(msg)

	const result = await studioBlueprint.getBaseline(context)

	// TODO - cleanup?

	return result
}
