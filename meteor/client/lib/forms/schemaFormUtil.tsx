import { JSONSchema, TypeName } from './schema-types'

export function joinFragments(...fragments: Array<string | number | undefined>): string {
	return fragments.filter((v) => v !== '' && v !== undefined && v !== null).join('.')
}

export type SchemaFormUpdateFunction = (path: string, val: any, mode?: 'push' | 'pull') => void

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
				return [
					{
						attr: prefix,
						name: summaryTitle,
					},
				]
			}

			return []
		}
	}
}
