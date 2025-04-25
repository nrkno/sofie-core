import {
	BlueprintMapping,
	BlueprintMappings,
	BlueprintParentDeviceSettings,
	IStudioSettings,
	JSONBlobParse,
	StudioRouteBehavior,
	TSR,
} from '@sofie-automation/blueprints-integration'
import {
	MappingsExt,
	StudioDeviceSettings,
	StudioIngestDevice,
	StudioInputDevice,
	StudioPackageContainer,
	StudioPlayoutDevice,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Complete, clone, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	BlueprintFixUpConfigForStudioResult,
	BlueprintValidateConfigForStudioResult,
} from '@sofie-automation/corelib/dist/worker/studio'
import { compileCoreConfigValues } from '../blueprints/config'
import { CommonContext } from '../blueprints/context'
import { JobContext } from '../jobs'
import { FixUpBlueprintConfigContext } from '@sofie-automation/corelib/dist/fixUpBlueprintConfig/context'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'

/**
 * Run the Blueprint applyConfig for the studio
 */
export async function handleBlueprintUpgradeForStudio(context: JobContext, _data: unknown): Promise<void> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.applyConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc?.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'applyConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = context.studio.blueprintConfig

	const result = blueprint.blueprint.applyConfig(
		blueprintContext,
		clone(rawBlueprintConfig),
		compileCoreConfigValues(context.studio.settings)
	)

	const parentDevices = Object.fromEntries(
		Object.entries<BlueprintParentDeviceSettings>(result.parentDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioDeviceSettings>>({
				name: dev[1].name ?? '',
				options: dev[1],
			}),
		])
	)
	const playoutDevices = Object.fromEntries(
		Object.entries<TSR.DeviceOptionsAny>(result.playoutDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioPlayoutDevice>>({
				peripheralDeviceId: undefined,
				options: dev[1],
			}),
		])
	)
	const ingestDevices = Object.fromEntries(
		Object.entries<unknown>(result.ingestDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioIngestDevice>>({
				peripheralDeviceId: undefined,
				options: dev[1],
			}),
		])
	)
	const inputDevices = Object.fromEntries(
		Object.entries<unknown>(result.inputDevices ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioInputDevice>>({
				peripheralDeviceId: undefined,
				options: dev[1],
			}),
		])
	)
	const routeSets = Object.fromEntries(
		Object.entries<Partial<StudioRouteSet>>(result.routeSets ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioRouteSet>>({
				name: dev[1].name ?? '',
				active: dev[1].active ?? false,
				defaultActive: dev[1].defaultActive ?? false,
				behavior: dev[1].behavior ?? StudioRouteBehavior.TOGGLE,
				exclusivityGroup: dev[1].exclusivityGroup ?? undefined,
				routes: dev[1].routes ?? [],
				abPlayers: dev[1].abPlayers ?? [],
			}),
		])
	)
	const routeSetExclusivityGroups = Object.fromEntries(
		Object.entries<Partial<StudioRouteSetExclusivityGroup>>(result.routeSetExclusivityGroups ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioRouteSetExclusivityGroup>>({
				name: dev[1].name ?? '',
			}),
		])
	)

	const packageContainers = Object.fromEntries(
		Object.entries<Partial<StudioPackageContainer>>(result.packageContainers ?? {}).map((dev) => [
			dev[0],
			literal<Complete<StudioPackageContainer>>({
				deviceIds: dev[1].deviceIds ?? [],
				container: dev[1].container as any,
			}),
		])
	)

	const studioSettings: IStudioSettings = result.studioSettings ?? {
		frameRate: 25,
		mediaPreviewsUrl: '',
		minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
		allowHold: true,
		allowPieceDirectPlay: true,
		enableBuckets: true,
		enableEvaluationForm: true,
	}

	await context.directCollections.Studios.update(context.studioId, {
		$set: {
			'settingsWithOverrides.defaults': studioSettings,
			'mappingsWithOverrides.defaults': translateMappings(result.mappings),
			'peripheralDeviceSettings.deviceSettings.defaults': parentDevices,
			'peripheralDeviceSettings.playoutDevices.defaults': playoutDevices,
			'peripheralDeviceSettings.ingestDevices.defaults': ingestDevices,
			'peripheralDeviceSettings.inputDevices.defaults': inputDevices,
			'routeSetsWithOverrides.defaults': routeSets,
			'routeSetExclusivityGroupsWithOverrides.defaults': routeSetExclusivityGroups,
			'packageContainersWithOverrides.defaults': packageContainers,
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

	for (const [id, mapping] of Object.entries<BlueprintMapping>(rawMappings)) {
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
	if (!blueprint.blueprintDoc?.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	const blueprintContext = new CommonContext({
		name: 'validateConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const rawBlueprintConfig = applyAndValidateOverrides(context.rawStudio.blueprintConfigWithOverrides).obj

	// This clone seems excessive, but without it a DataCloneError is generated when posting the result to the parent
	const messages = clone(blueprint.blueprint.validateConfig(blueprintContext, rawBlueprintConfig))

	return {
		messages: messages.map((msg) => ({
			level: msg.level,
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint.blueprintId]),
		})),
	}
}

export async function handleBlueprintFixUpConfigForStudio(
	context: JobContext,
	_data: unknown
): Promise<BlueprintFixUpConfigForStudioResult> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.validateConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc?.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	if (typeof blueprint.blueprint.fixUpConfig !== 'function') {
		if (context.studio.lastBlueprintFixUpHash) {
			// Cleanup property to avoid getting stuck
			await context.directCollections.Studios.update(context.studioId, {
				$unset: {
					lastBlueprintFixUpHash: 1,
				},
			})
		}
		throw new Error('Blueprint does not support this config flow')
	}

	const commonContext = new CommonContext({
		name: 'fixupConfig',
		identifier: `studio:${context.studioId},blueprint:${blueprint.blueprintId}`,
	})
	const blueprintContext = new FixUpBlueprintConfigContext(
		commonContext,
		JSONBlobParse(blueprint.blueprint.studioConfigSchema),
		context.rawStudio.blueprintConfigWithOverrides
	)

	blueprint.blueprint.fixUpConfig(blueprintContext)

	// Save the 'fixed' config
	await context.directCollections.Studios.update(context.studioId, {
		$set: {
			lastBlueprintFixUpHash: blueprint.blueprintDoc.blueprintHash,
			blueprintConfigWithOverrides: blueprintContext.configObject,
		},
	})

	return {
		messages: blueprintContext.messages.map((msg) => ({
			message: wrapTranslatableMessageFromBlueprints(msg.message, [blueprint.blueprintId]),
			path: msg.path,
		})),
	}
}

export async function handleBlueprintIgnoreFixUpConfigForStudio(context: JobContext, _data: unknown): Promise<void> {
	const blueprint = context.studioBlueprint
	if (typeof blueprint.blueprint.validateConfig !== 'function')
		throw new Error('Blueprint does not support this config flow')
	if (!blueprint.blueprintDoc?.blueprintHash) throw new Error('Blueprint is not valid')
	if (!context.studio.blueprintConfigPresetId) throw new Error('Studio is missing config preset')

	if (typeof blueprint.blueprint.fixUpConfig !== 'function') {
		if (context.studio.lastBlueprintFixUpHash) {
			// Cleanup property to avoid getting stuck
			await context.directCollections.Studios.update(context.studioId, {
				$unset: {
					lastBlueprintFixUpHash: 1,
				},
			})
		}
		throw new Error('Blueprint does not support this config flow')
	}

	// Save the 'fixed' config
	await context.directCollections.Studios.update(context.studioId, {
		$set: {
			lastBlueprintFixUpHash: blueprint.blueprintDoc.blueprintHash,
		},
	})
}
