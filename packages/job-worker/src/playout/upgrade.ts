import { BlueprintMappings } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { compileCoreConfigValues } from '../blueprints/config'
import { CommonContext } from '../blueprints/context'
import { JobContext } from '../jobs'

/**
 * Run the Blueprint applyConfig for the studio
 */
export async function handleBlueprintUpgradeForStudio(context: JobContext, _data: unknown): Promise<void> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.applyConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc || !blueprint.blueprintDoc.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'applyConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.studio.blueprintConfigWithOverrides).obj

	const result = blueprint.blueprint.applyConfig(
		blueprintContext,
		clone(rawBlueprintConfig),
		compileCoreConfigValues()
	)

	await context.directCollections.Studios.update(context.studioId, {
		$set: {
			'mappingsWithOverrides.defaults': translateMappings(result.mappings),
			lastBlueprintConfig: {
				blueprintHash: blueprint.blueprintDoc.blueprintHash,
				blueprintId: blueprint.blueprintId,
				blueprintConfigPresetId: context.studio.blueprintConfigPresetId,
				config: rawBlueprintConfig,
			},
		},
	})
}

function translateMappings(rawMappings: BlueprintMappings): MappingsExt {
	const mappings: MappingsExt = {}

	for (const [id, mapping] of Object.entries(rawMappings)) {
		mappings[id] = {
			...mapping,
			deviceId: protectString(mapping.deviceId),
		}
	}

	return mappings
}

/**
 * Validate the blueprintConfig for the Studio, with the Blueprint validateConfig
 */
export async function handleBlueprintValidateConfigForStudio(
	context: JobContext,
	_data: unknown
): Promise<BlueprintValidateConfigForStudioResult> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.validateConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc || !blueprint.blueprintDoc.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'validateConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.studio.blueprintConfigWithOverrides).obj

	// TODO - why is this clone necessary?
	const messages = clone(blueprint.blueprint.validateConfig(blueprintContext, rawBlueprintConfig))

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint.blueprintId]),
		})),
	}
}
