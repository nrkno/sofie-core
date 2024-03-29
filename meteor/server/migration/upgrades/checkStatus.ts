import {
	BlueprintManifestType,
	IStudioConfigPreset,
	IShowStyleConfigPreset,
	ITranslatableMessage,
} from '@sofie-automation/blueprints-integration'
import { Blueprint, BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	normalizeArrayToMap,
	literal,
	objectPathGet,
	joinObjectPathFragments,
} from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import _ from 'underscore'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultStudio,
	GetUpgradeStatusResultShowStyleBase,
} from '../../../lib/api/migration'
import { Blueprints, ShowStyleBases, Studios } from '../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Studio } from '../../../lib/collections/Studios'
import { generateTranslation } from '../../../lib/lib'
import { JSONBlob, JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { logger } from '../../logging'

export async function getUpgradeStatus(): Promise<GetUpgradeStatusResult> {
	const studioUpgrades = await checkStudiosUpgradeStatus()
	const showStyleUpgrades = await checkShowStyleBaseUpgradeStatus()

	return {
		studios: studioUpgrades,
		showStyleBases: showStyleUpgrades,
	}
}

async function checkStudiosUpgradeStatus(): Promise<GetUpgradeStatusResultStudio[]> {
	const result: GetUpgradeStatusResultStudio[] = []

	const studios = (await Studios.findFetchAsync(
		{},
		{
			fields: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigPresetId: 1,
				lastBlueprintConfig: 1,
				blueprintConfigWithOverrides: 1,
				name: 1,
			},
		}
	)) as Array<StudioForUpgradeCheck>

	const studioBlueprints = (await Blueprints.findFetchAsync(
		{
			blueprintType: BlueprintManifestType.STUDIO,
			_id: { $in: _.compact(studios.map((st) => st.blueprintId)) },
		},
		{
			fields: {
				_id: 1,
				studioConfigPresets: 1,
				studioConfigSchema: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<StudioBlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(
		studioBlueprints.map((doc) =>
			literal<BlueprintMapEntry>({
				_id: doc._id,
				configPresets: doc.studioConfigPresets,
				configSchema: doc.studioConfigSchema,
				blueprintHash: doc.blueprintHash,
			})
		),
		'_id'
	)
	for (const studio of studios) {
		result.push({
			...checkDocUpgradeStatus(blueprintsMap, studio),
			studioId: studio._id,
			name: studio.name,
		})
	}

	return result
}

async function checkShowStyleBaseUpgradeStatus(): Promise<GetUpgradeStatusResultShowStyleBase[]> {
	const result: GetUpgradeStatusResultShowStyleBase[] = []

	const showStyles = (await ShowStyleBases.findFetchAsync(
		{},
		{
			fields: {
				_id: 1,
				blueprintId: 1,
				blueprintConfigPresetId: 1,
				lastBlueprintConfig: 1,
				blueprintConfigWithOverrides: 1,
				name: 1,
			},
		}
	)) as Array<ShowStyleBaseForUpgradeCheck>

	const showStyleBlueprints = (await Blueprints.findFetchAsync(
		{
			blueprintType: BlueprintManifestType.SHOWSTYLE,
			_id: { $in: _.compact(showStyles.map((st) => st.blueprintId)) },
		},
		{
			fields: {
				_id: 1,
				showStyleConfigPresets: 1,
				showStyleConfigSchema: 1,
				blueprintHash: 1,
			},
		}
	)) as Array<ShowStyleBlueprintForUpgradeCheck>

	// Check each studio
	const blueprintsMap = normalizeArrayToMap(
		showStyleBlueprints.map((doc) =>
			literal<BlueprintMapEntry>({
				_id: doc._id,
				configPresets: doc.showStyleConfigPresets,
				configSchema: doc.showStyleConfigSchema,
				blueprintHash: doc.blueprintHash,
			})
		),
		'_id'
	)
	for (const showStyle of showStyles) {
		result.push({
			...checkDocUpgradeStatus(blueprintsMap, showStyle),
			showStyleBaseId: showStyle._id,
			name: showStyle.name,
		})
	}

	return result
}

type StudioForUpgradeCheck = Pick<
	Studio,
	'_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'lastBlueprintConfig' | 'blueprintConfigWithOverrides' | 'name'
>
type ShowStyleBaseForUpgradeCheck = Pick<
	DBShowStyleBase,
	'_id' | 'blueprintId' | 'blueprintConfigPresetId' | 'lastBlueprintConfig' | 'blueprintConfigWithOverrides' | 'name'
>
type StudioBlueprintForUpgradeCheck = Pick<
	Blueprint,
	'_id' | 'studioConfigPresets' | 'studioConfigSchema' | 'blueprintHash'
>
type ShowStyleBlueprintForUpgradeCheck = Pick<
	Blueprint,
	'_id' | 'showStyleConfigPresets' | 'showStyleConfigSchema' | 'blueprintHash'
>

interface BlueprintMapEntry {
	_id: BlueprintId
	configPresets: Record<string, IStudioConfigPreset> | Record<string, IShowStyleConfigPreset> | undefined
	configSchema: JSONBlob<JSONSchema> | undefined
	blueprintHash: BlueprintHash | undefined
}

function checkDocUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintMapEntry>,
	doc: StudioForUpgradeCheck | ShowStyleBaseForUpgradeCheck
): Pick<GetUpgradeStatusResultStudio, 'invalidReason' | 'changes'> {
	// Check the blueprintId is valid
	const blueprint = doc.blueprintId ? blueprintMap.get(doc.blueprintId) : null
	if (!blueprint || !blueprint.configPresets) {
		// Studio blueprint is missing/invalid
		return {
			invalidReason: generateTranslation('Invalid blueprint: "{{blueprintId}}"', {
				blueprintId: doc.blueprintId,
			}),
			changes: [],
		}
	}

	// Check the blueprintConfigPresetId is valid
	const configPreset = doc.blueprintConfigPresetId ? blueprint.configPresets[doc.blueprintConfigPresetId] : undefined
	if (!configPreset) {
		return {
			invalidReason: generateTranslation(
				'Invalid config preset for blueprint: "{{configPresetId}}" ({{blueprintId}})',
				{
					configPresetId: doc.blueprintConfigPresetId ?? '',
					blueprintId: doc.blueprintId,
				}
			),
			changes: [],
		}
	}

	const changes: ITranslatableMessage[] = []

	// Some basic property checks
	if (!doc.lastBlueprintConfig) {
		changes.push(generateTranslation('Config has not been applied before'))
	} else if (doc.lastBlueprintConfig.blueprintId !== doc.blueprintId) {
		changes.push(
			generateTranslation('Blueprint has been changed. From "{{ oldValue }}", to "{{ newValue }}"', {
				oldValue: doc.lastBlueprintConfig.blueprintId || '',
				newValue: doc.blueprintId || '',
			})
		)
	} else if (doc.lastBlueprintConfig.blueprintConfigPresetId !== doc.blueprintConfigPresetId) {
		changes.push(
			generateTranslation(
				'Blueprint config preset has been changed. From "{{ oldValue }}", to "{{ newValue }}"',
				{
					oldValue: doc.lastBlueprintConfig.blueprintConfigPresetId || '',
					newValue: doc.blueprintConfigPresetId || '',
				}
			)
		)
	} else if (doc.lastBlueprintConfig.blueprintHash !== blueprint.blueprintHash) {
		changes.push(generateTranslation('Blueprint has a new version'))
	}

	if (doc.lastBlueprintConfig) {
		// Check if the config blob has changed since last run
		const newConfig = applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj
		const oldConfig = doc.lastBlueprintConfig.config

		// Do a simple check, in case we miss the change when comparing the manifest properties
		if (!_.isEqual(newConfig, oldConfig)) {
			changes.push(generateTranslation('Blueprint config has changed'))

			// also do a deeper diff
			if (blueprint.configSchema) {
				try {
					changes.push(
						...diffJsonSchemaObjects(
							JSONBlobParse(blueprint.configSchema),
							['blueprint_' + doc.blueprintId],
							oldConfig,
							newConfig
						)
					)
				} catch (e) {
					changes.push(generateTranslation('Failed to compare config changes'))
					logger.error(`Faield to compare configs: ${stringifyError(e)}`)
				}
			}
		}
	}

	return {
		changes,
	}
}

/**
 * This is a slightly crude diffing of objects based on a jsonschema. Only keys in the schema will be compared.
 * For now this has some limitations such as not looking inside of arrays, but this could be expanded later on
 */
function diffJsonSchemaObjects(
	schema: JSONSchema,
	translationNamespaces: string[],
	objA: unknown,
	objB: unknown,
	pathPrefix?: string
): ITranslatableMessage[] {
	const changes: ITranslatableMessage[] = []

	for (const [id, propSchema] of Object.entries<JSONSchema>(schema.properties || {})) {
		const propPath = joinObjectPathFragments(pathPrefix, id)
		const valueA = objectPathGet(objA, id)
		const valueB = objectPathGet(objB, id)

		if (propSchema.type === 'object' && !propSchema.patternProperties) {
			changes.push(...diffJsonSchemaObjects(propSchema, translationNamespaces, valueA, valueB, propPath))
		} else {
			if (!_.isEqual(valueA, valueB)) {
				changes.push(
					generateTranslation(
						'Config value "{{ name }}" has changed. From "{{ oldValue }}", to "{{ newValue }}"',
						{
							name: propSchema['ui:title'] || propPath,
							oldValue: valueA ?? '',
							newValue: valueB ?? '',
						},
						translationNamespaces
					)
				)
			}
		}
	}

	return changes
}
