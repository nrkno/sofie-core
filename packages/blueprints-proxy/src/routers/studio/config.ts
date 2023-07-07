import type { IConfigMessage, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { CommonContext } from '../../context/common'
import type { StudioValidateConfigArgs } from '../../index'
import { MySocket } from '../util'

export async function studio_validateConfig(
	studioBlueprint: StudioBlueprintManifest,
	_socket: MySocket,
	_id: string,
	msg: StudioValidateConfigArgs
): Promise<IConfigMessage[]> {
	if (!studioBlueprint.validateConfig) throw new Error('Not supported') // TODO - this will have broken our ability to know if it is implemented or not..

	const context = new CommonContext(`validateConfig ${msg.identifier}`)

	return studioBlueprint.validateConfig(context, msg.config)
}
