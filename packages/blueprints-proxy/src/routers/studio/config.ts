import type {
	BlueprintResultApplyStudioConfig,
	IConfigMessage,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { CommonContext } from '../../context/common'
import type { StudioApplyConfigArgs, StudioPreprocessConfigArgs, StudioValidateConfigArgs } from '../../index'
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

export async function studio_applyConfig(
	studioBlueprint: StudioBlueprintManifest,
	_socket: MySocket,
	_id: string,
	msg: StudioApplyConfigArgs
): Promise<BlueprintResultApplyStudioConfig> {
	if (!studioBlueprint.applyConfig) throw new Error('Not supported') // TODO - this will have broken our ability to know if it is implemented or not..

	const context = new CommonContext(`applyConfig ${msg.identifier}`)

	return studioBlueprint.applyConfig(context, msg.config, msg.coreConfig)
}

export async function studio_preprocessConfig(
	studioBlueprint: StudioBlueprintManifest,
	_socket: MySocket,
	_id: string,
	msg: StudioPreprocessConfigArgs
): Promise<unknown> {
	if (!studioBlueprint.preprocessConfig) throw new Error('Not supported') // TODO - this will have broken our ability to know if it is implemented or not..

	const context = new CommonContext(`applyConfig ${msg.identifier}`)

	return studioBlueprint.preprocessConfig(context, msg.config, msg.coreConfig)
}
