import {
	ConfigManifestEntryString,
	ConfigManifestEntryMultilineString,
	ConfigManifestEntryInt,
	ConfigManifestEntryFloat,
	ConfigManifestEntryBoolean,
	ConfigManifestEntryEnum,
	ConfigManifestEntrySelectFromOptions,
	ConfigManifestEntrySelectFromColumn,
	ConfigManifestEntrySourceLayers,
	ConfigManifestEntryLayerMappings,
	ConfigManifestEntryJson,
	ConfigManifestEntryTable,
	ConfigManifestEntryType,
	SourceLayerType,
	IBlueprintConfig,
} from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { DropdownInputOption } from '../../../lib/Components/DropdownInput'

export interface SourceLayerDropdownOption extends DropdownInputOption<string> {
	type: SourceLayerType
}

export type ResolvedBasicConfigManifestEntry =
	| ConfigManifestEntryString
	| ConfigManifestEntryMultilineString
	| ConfigManifestEntryInt
	| ConfigManifestEntryFloat
	| ConfigManifestEntryBoolean
	| ConfigManifestEntryEnum
	| ConfigManifestEntrySelectFromOptions<boolean>
	| (ConfigManifestEntrySelectFromColumn<boolean> & { options: DropdownInputOption<string>[] })
	| (ConfigManifestEntrySourceLayers<boolean> & { options: DropdownInputOption<string>[] })
	| (ConfigManifestEntryLayerMappings<boolean> & { options: DropdownInputOption<string>[] })
	| ConfigManifestEntryJson

export function resolveTableColumns(
	manifest: ConfigManifestEntryTable,
	layerMappings: { [studioId: string]: MappingsExt } | undefined,
	sourceLayers: Array<SourceLayerDropdownOption> | undefined,
	fullConfig: IBlueprintConfig,
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined
): (ResolvedBasicConfigManifestEntry & { rank: number })[] {
	// Shallow clone and sort
	const columns = [...manifest.columns]
	columns.sort()

	return columns.map((column): ResolvedBasicConfigManifestEntry & { rank: number } => {
		switch (column.type) {
			case ConfigManifestEntryType.SOURCE_LAYERS:
				return {
					...column,
					options: sourceLayers ? filterSourceLayers(column, sourceLayers) : [],
				}
			case ConfigManifestEntryType.LAYER_MAPPINGS:
				return {
					...column,
					options: layerMappings ? filterLayerMappings(column, layerMappings) : [],
				}
			case ConfigManifestEntryType.SELECT_FROM_COLUMN:
				return {
					...column,
					options: layerMappings ? getTableColumnValues(column, fullConfig, alternateConfig) : [],
				}
			default:
				return column
		}
	})
}

export function filterSourceLayers(
	select: ConfigManifestEntrySourceLayers<true | false>,
	layers: Array<SourceLayerDropdownOption>
): DropdownInputOption<string>[] {
	if (select.filters && select.filters.sourceLayerTypes) {
		const sourceLayerTypes = new Set(select.filters.sourceLayerTypes)
		return layers.filter((layer) => sourceLayerTypes.has(layer.type))
	} else {
		return layers
	}
}

export function filterLayerMappings(
	select: ConfigManifestEntryLayerMappings<true | false>,
	mappings: { [studioId: string]: MappingsExt }
): DropdownInputOption<string>[] {
	const deviceTypes = select.filters?.deviceTypes
	const result: DropdownInputOption<string>[] = []

	for (const studioMappings of Object.values(mappings)) {
		for (const [layerId, mapping] of Object.entries(studioMappings)) {
			if (!deviceTypes || deviceTypes.includes(mapping.device)) {
				result.push({ name: mapping.layerName || layerId, value: layerId, i: result.length })
			}
		}
	}

	return result
}

export function getTableColumnValues(
	item: ConfigManifestEntrySelectFromColumn<boolean>,
	object: IBlueprintConfig,
	alternateConfig: IBlueprintConfig | undefined
): DropdownInputOption<string>[] {
	const attribute = item.tableId
	const table = objectPathGet(object, attribute) ?? objectPathGet(alternateConfig, attribute)
	const result: DropdownInputOption<string>[] = []
	if (!Array.isArray(table)) {
		return result
	}
	table.forEach((row) => {
		if (typeof row === 'object' && row[item.columnId] !== undefined) {
			result.push({
				name: `${row[item.columnId]}`,
				value: `${row[item.columnId]}`,
				i: result.length,
			})
		}
	})
	return result
}
