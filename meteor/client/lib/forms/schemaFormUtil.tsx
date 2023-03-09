import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../../ui/i18n'
import { JSONSchema, TypeName } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

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
}

export interface SchemaFormCommonProps {
	schema: JSONSchema
	translationNamespaces: string[]

	/**
	 * In some situations, it is desirable to not allow tables to be used by a schema
	 * For example, a table inside a table will not display properly so this gets set automatically
	 */
	allowTables?: boolean
}

export function joinObjectPathFragments(...fragments: Array<string | number | undefined>): string {
	return fragments.filter((v) => v !== '' && v !== undefined && v !== null).join('.')
}

export function translateStringIfHasNamespaces(str: string, translationNamespaces: string[] | undefined): string {
	return translationNamespaces ? translateMessage({ key: str, namespaces: translationNamespaces }, i18nTranslator) : str
}

export interface SchemaSummaryField {
	attr: string
	name: string
	transform?: (val: any) => string
}

export function getSchemaSummaryFieldsForObject(
	schema: Record<string, JSONSchema | undefined>,
	prefix?: string
): SchemaSummaryField[] {
	const fieldNames: SchemaSummaryField[] = []

	for (const [index, prop] of Object.entries(schema)) {
		if (prop) {
			const newPrefix = joinObjectPathFragments(prefix, index)

			fieldNames.push(...getSchemaSummaryFields(prop, newPrefix))
		}
	}

	return fieldNames
}

export function getSchemaSummaryFields(schema: JSONSchema, prefix?: string): SchemaSummaryField[] {
	switch (schema.type) {
		case TypeName.Object:
			return getSchemaSummaryFieldsForObject(schema.properties || {})
		default: {
			const summaryTitle: string = schema[SchemaFormUIField.SummaryTitle]
			if (summaryTitle && prefix) {
				let transform: SchemaSummaryField['transform']

				if (schema.type === 'integer' && schema[SchemaFormUIField.ZeroBased]) {
					// Int fields can be zero indexed
					transform = (val) => {
						if (!isNaN(val)) {
							return `${Number(val) + 1}`
						} else {
							return val
						}
					}
				}

				return [
					{
						attr: prefix,
						name: summaryTitle,
						transform,
					},
				]
			}

			return []
		}
	}
}
