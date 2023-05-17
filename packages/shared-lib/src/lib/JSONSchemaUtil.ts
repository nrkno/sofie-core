import { JSONSchema, TypeName } from './JSONSchemaTypes'

/**
 * The custom JSONSchema properties we can use for building the UI
 */
export enum SchemaFormUIField {
	/**
	 * Category of the property
	 */
	Category = 'ui:category',
	/**
	 * Title of the property
	 */
	Title = 'ui:title',
	/**
	 * Description/hint for the property
	 */
	Description = 'ui:description',
	/**
	 * If set, when in a table this property will be used as part of the summary with this label
	 */
	SummaryTitle = 'ui:summaryTitle',
	/**
	 * If an integer property, whether to treat it as zero-based
	 */
	ZeroBased = 'ui:zeroBased',
	/**
	 * Override the presentation with a special mode.
	 * Currently only valid for string properties. Valid values are 'json'.
	 */
	DisplayType = 'ui:displayType',
	/**
	 * Name of the enum values as generated for the typescript enum.
	 * Future: a new field should probably be added for the UI to use.
	 */
	TsEnumNames = 'tsEnumNames',
	/**
	 * Use a Sofie enum type
	 * Only valid for string properties or arrays of strings
	 * Valid values are 'mappings' and 'source-layers', any other value will result in an empty dropdown
	 */
	SofieEnum = 'ui:sofie-enum',
	/**
	 * When using `ui:sofie-enum`, filter the options by type
	 */
	SofieEnumFilter = 'ui:sofie-enum:filter',
}

export function getSchemaDefaultValues(schema: JSONSchema | undefined): any {
	switch (schema?.type) {
		case TypeName.Object: {
			const object: any = {}

			for (const [index, prop] of Object.entries<JSONSchema>(schema.properties || {})) {
				object[index] = getSchemaDefaultValues(prop)
			}

			return object
		}
		default:
			return schema?.default
	}
}
