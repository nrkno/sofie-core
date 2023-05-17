import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../../ui/i18n'
import { JSONSchema, TypeName } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormUIField } from '@sofie-automation/blueprints-integration'
import { joinObjectPathFragments } from '@sofie-automation/corelib/dist/lib'

export interface SchemaFormSofieEnumDefinition {
	options: {
		name: string
		value: string
		filter: number | string
	}[]
}

export interface SchemaFormCommonProps {
	/** Schema for each row in the table */
	schema: JSONSchema
	/** Translation namespaces for the schama */
	translationNamespaces: string[]

	/** Allow special 'built-in' enum types to be used with the 'ui:sofie-enum' property in the schema */
	sofieEnumDefinitons?: Record<string, SchemaFormSofieEnumDefinition>

	/**
	 * In some situations, it is desirable to not allow tables to be used by a schema
	 * For example, a table inside a table will not display properly so this gets set automatically
	 */
	allowTables?: boolean
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

	for (const [index, prop] of Object.entries<JSONSchema | undefined>(schema)) {
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

				// For an array of primitives, we should consider the primitive
				const schemaForEnum =
					schema.type === 'array' && (schema.items?.type === 'string' || schema.items?.type === 'integer')
						? schema.items
						: schema
				if (schemaForEnum.enum && schemaForEnum[SchemaFormUIField.TsEnumNames]) {
					// For enum items, we should display the pretty name
					const tsEnumNames = (schemaForEnum[SchemaFormUIField.TsEnumNames] || []) as string[]
					const valueToNameMap = new Map<string | number, string>()

					schemaForEnum.enum.forEach((value: any, i: number) => {
						valueToNameMap.set(value, tsEnumNames[i] || value)
					})

					transform = (val) => {
						if (Array.isArray(val)) {
							return val.map((v) => valueToNameMap.get(v) ?? v).join(', ')
						} else {
							return valueToNameMap.get(val) ?? val
						}
					}
				} else if (schema.type === 'integer' && schema[SchemaFormUIField.ZeroBased]) {
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
