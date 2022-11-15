import { BlueprintMappings } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { compileCoreConfigValues } from '../blueprints/config'
import { CommonContext } from '../blueprints/context'
import { JobContext } from '../jobs'
import { logger } from '../logging'

/**
 * Ensure that the infinite pieces on the nexted-part are correct
 * Added to debug some issues with infinites not updating
 */
export async function handleBlueprintUpgradeForStudio(context: JobContext, _data: unknown): Promise<void> {
	logger.info(`handleBlueprintUpgrade`)

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
