import { JSONSchema, TypeName } from './JSONSchemaTypes'

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
