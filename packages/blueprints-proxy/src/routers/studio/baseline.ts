import {
	BlueprintMappings,
	BlueprintResultStudioBaseline,
	IStudioBaselineContext,
	PackageInfo,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { StudioGetBaselineArgs } from '@sofie-automation/shared-lib'
import { StudioContext } from '../../context/studioContext'
import { MySocket } from '../util'

class StudioBaselineContext extends StudioContext implements IStudioBaselineContext {
	constructor(msg: StudioGetBaselineArgs, socket: MySocket, functionId: string) {
		super('getBaseline', socket, functionId, msg)
	}

	async getStudioMappings(): Promise<Readonly<BlueprintMappings>> {
		return this.emitCall('studio_getStudioMappings', {})
	}
	async getPackageInfo(packageId: string): Promise<readonly PackageInfo.Any[]> {
		return this.emitCall('packageInfo_getPackageInfo', { packageId })
	}
	async hackGetMediaObjectDuration(mediaId: string): Promise<number | undefined> {
		return this.emitCall('packageInfo_hackGetMediaObjectDuration', { mediaId })
	}
}

export async function studio_getBaseline(
	studioBlueprint: StudioBlueprintManifest,
	socket: MySocket,
	id: string,
	msg: StudioGetBaselineArgs
): Promise<BlueprintResultStudioBaseline> {
	const context = new StudioBaselineContext(msg, socket, id)

	return studioBlueprint.getBaseline(context)
}
