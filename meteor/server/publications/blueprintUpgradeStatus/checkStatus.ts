import {
	IShowStyleConfigPreset,
	IStudioConfigPreset,
	ITranslatableMessage,
	JSONBlob,
	JSONBlobParse,
	JSONSchema,
} from '@sofie-automation/blueprints-integration'
import { BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { joinObjectPathFragments, objectPathGet, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { GetUpgradeStatusResultStudio } from '../../../lib/api/migration'
import { generateTranslation } from '../../../lib/lib'
import { logger } from '../../logging'
import { ShowStyleBaseFields, StudioFields } from './reactiveContentCache'
import _ from 'underscore'

export interface BlueprintMapEntry {
	_id: BlueprintId
	configPresets: Record<string, IStudioConfigPreset> | Record<string, IShowStyleConfigPreset> | undefined
	configSchema: JSONBlob<JSONSchema> | undefined
	blueprintHash: BlueprintHash | undefined
}

export function checkDocUpgradeStatus(
	blueprintMap: Map<BlueprintId, BlueprintMapEntry>,
	doc: Pick<DBStudio, StudioFields> | Pick<DBShowStyleBase, ShowStyleBaseFields>
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
							// Future: this is not pretty when it is an object
							oldValue: JSON.stringify(valueA) ?? '',
							newValue: JSON.stringify(valueB) ?? '',
						},
						translationNamespaces
					)
				)
			}
		}
	}

	return changes
}
