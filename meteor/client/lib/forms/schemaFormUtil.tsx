import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../../ui/i18n'
import { JSONSchema, TypeName } from './schema-types'

export function joinFragments(...fragments: Array<string | number | undefined>): string {
	return fragments.filter((v) => v !== '' && v !== undefined && v !== null).join('.')
}

export function translateStringIfHasNamespaces(str: string, translationNamespaces: string[] | undefined): string {
	return translationNamespaces ? translateMessage({ key: str, namespaces: translationNamespaces }, i18nTranslator) : str
}

export function getSchemaDefaultValues(schema: JSONSchema | undefined): any {
	switch (schema?.type) {
		case TypeName.Object: {
			const object: any = {}

			for (const [index, prop] of Object.entries(schema.properties || {})) {
				object[index] = getSchemaDefaultValues(prop)
			}

			return object
		}
		default:
			return schema?.default
	}
}

export interface SchemaSummaryField {
	attr: string
	name: string
	transform?: (val: any) => string
}

export function getSchemaSummaryFieldsForObject(schema: Record<string, JSONSchema | undefined>, prefix?: string) {
	const fieldNames: SchemaSummaryField[] = []

	for (const [index, prop] of Object.entries(schema)) {
		if (prop) {
			const newPrefix = joinFragments(prefix, index)

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
			const summaryTitle: string = schema['ui:summaryTitle']
			if (summaryTitle && prefix) {
				let transform: SchemaSummaryField['transform']
				if (schema.type === 'integer' && schema['ui:zeroBased']) {
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
